import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import crypto from 'crypto';

function generateScannerCode(): string {
  return 'SCAN-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export const scannerRouter = createTRPCRouter({
  createInvitation: publicProcedure
    .input(z.object({
      promoterId: z.string(),
      eventId: z.string().optional(),
      maxUses: z.number().min(1).default(1),
      expiresInDays: z.number().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = `scanner_inv_${Date.now()}`;
      const code = generateScannerCode();
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      ctx.db.prepare(`
        INSERT INTO scanner_invitations (id, code, promoter_id, event_id, max_uses, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(id, code, input.promoterId, input.eventId || null, input.maxUses, expiresAt);

      return { success: true, code, id };
    }),

  getInvitations: publicProcedure
    .input(z.object({
      promoterId: z.string(),
    }))
    .query(({ ctx, input }) => {
      const invitations = ctx.db.prepare(`
        SELECT si.*, p.name as promoter_name, e.name as event_name
        FROM scanner_invitations si
        LEFT JOIN promoters p ON si.promoter_id = p.id
        LEFT JOIN events e ON si.event_id = e.id
        WHERE si.promoter_id = ?
        ORDER BY si.created_at DESC
      `).all(input.promoterId) as any[];

      return invitations.map(inv => ({
        id: inv.id,
        code: inv.code,
        promoterId: inv.promoter_id,
        promoterName: inv.promoter_name,
        eventId: inv.event_id,
        eventName: inv.event_name,
        maxUses: inv.max_uses,
        currentUses: inv.current_uses,
        expiresAt: inv.expires_at,
        isActive: inv.is_active === 1,
        createdAt: inv.created_at,
      }));
    }),

  deleteInvitation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM scanner_invitations WHERE id = ?').run(input.id);
      return { success: true };
    }),

  toggleInvitation: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('UPDATE scanner_invitations SET is_active = ? WHERE id = ?').run(input.isActive ? 1 : 0, input.id);
      return { success: true };
    }),

  validateInvitation: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(({ ctx, input }) => {
      const invitation = ctx.db.prepare(`
        SELECT si.*, p.name as promoter_name, e.name as event_name
        FROM scanner_invitations si
        LEFT JOIN promoters p ON si.promoter_id = p.id
        LEFT JOIN events e ON si.event_id = e.id
        WHERE si.code = ? AND si.is_active = 1
        AND (si.expires_at IS NULL OR si.expires_at > datetime('now'))
        AND (si.max_uses = 0 OR si.current_uses < si.max_uses)
      `).get(input.code.toUpperCase()) as any;

      if (!invitation) {
        return { valid: false, invitation: null };
      }

      return {
        valid: true,
        invitation: {
          id: invitation.id,
          code: invitation.code,
          promoterId: invitation.promoter_id,
          promoterName: invitation.promoter_name,
          eventId: invitation.event_id,
          eventName: invitation.event_name,
        },
      };
    }),

  registerWithInvitation: publicProcedure
    .input(z.object({
      code: z.string(),
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const invitation = ctx.db.prepare(`
        SELECT * FROM scanner_invitations
        WHERE code = ? AND is_active = 1
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (max_uses = 0 OR current_uses < max_uses)
      `).get(input.code.toUpperCase()) as any;

      if (!invitation) {
        throw new Error('Código de invitación inválido, expirado o agotado');
      }

      const existingUser = ctx.db.prepare('SELECT id FROM scanner_users WHERE email = ?').get(input.email.toLowerCase()) as any;
      if (existingUser) {
        throw new Error('Este email ya está registrado como personal de escaneo');
      }

      const scannerId = `scanner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = hashPassword(input.password);

      ctx.db.prepare(`
        INSERT INTO scanner_users (id, name, email, password_hash, promoter_id, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(scannerId, input.name, input.email.toLowerCase(), passwordHash, invitation.promoter_id);

      if (invitation.event_id) {
        const accessId = `access_${Date.now()}`;
        ctx.db.prepare(`
          INSERT INTO scanner_event_access (id, scanner_id, event_id)
          VALUES (?, ?, ?)
        `).run(accessId, scannerId, invitation.event_id);
      } else {
        const promoterEvents = ctx.db.prepare(`
          SELECT id FROM events WHERE promoter_id = ? AND is_active = 1
        `).all(invitation.promoter_id) as any[];

        for (const event of promoterEvents) {
          const accessId = `access_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          ctx.db.prepare(`
            INSERT OR IGNORE INTO scanner_event_access (id, scanner_id, event_id)
            VALUES (?, ?, ?)
          `).run(accessId, scannerId, event.id);
        }
      }

      ctx.db.prepare(`
        UPDATE scanner_invitations SET current_uses = current_uses + 1 WHERE id = ?
      `).run(invitation.id);

      return {
        success: true,
        scanner: {
          id: scannerId,
          name: input.name,
          email: input.email.toLowerCase(),
          promoterId: invitation.promoter_id,
        },
      };
    }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const scanner = ctx.db.prepare(`
        SELECT su.*, p.name as promoter_name
        FROM scanner_users su
        LEFT JOIN promoters p ON su.promoter_id = p.id
        WHERE su.email = ? AND su.is_active = 1
      `).get(input.email.toLowerCase()) as any;

      if (!scanner) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      if (!verifyPassword(input.password, scanner.password_hash)) {
        throw new Error('Contraseña incorrecta');
      }

      const eventAccess = ctx.db.prepare(`
        SELECT e.id, e.name FROM scanner_event_access sea
        JOIN events e ON sea.event_id = e.id
        WHERE sea.scanner_id = ? AND e.is_active = 1
      `).all(scanner.id) as any[];

      return {
        success: true,
        scanner: {
          id: scanner.id,
          name: scanner.name,
          email: scanner.email,
          promoterId: scanner.promoter_id,
          promoterName: scanner.promoter_name,
          events: eventAccess.map(e => ({ id: e.id, name: e.name })),
        },
      };
    }),

  loginWithCode: publicProcedure
    .input(z.object({
      code: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invitation = ctx.db.prepare(`
        SELECT si.*, p.name as promoter_name
        FROM scanner_invitations si
        LEFT JOIN promoters p ON si.promoter_id = p.id
        WHERE si.code = ? AND si.is_active = 1
        AND (si.expires_at IS NULL OR si.expires_at > datetime('now'))
      `).get(input.code.toUpperCase()) as any;

      if (!invitation) {
        throw new Error('Código de acceso inválido o expirado');
      }

      let events: any[] = [];
      if (invitation.event_id) {
        const event = ctx.db.prepare('SELECT id, name FROM events WHERE id = ?').get(invitation.event_id) as any;
        if (event) events = [{ id: event.id, name: event.name }];
      } else {
        events = ctx.db.prepare(`
          SELECT id, name FROM events WHERE promoter_id = ? AND is_active = 1
        `).all(invitation.promoter_id) as any[];
      }

      return {
        success: true,
        accessType: 'code',
        promoterId: invitation.promoter_id,
        promoterName: invitation.promoter_name,
        events: events.map(e => ({ id: e.id, name: e.name })),
      };
    }),

  getScannerUsers: publicProcedure
    .input(z.object({
      promoterId: z.string(),
    }))
    .query(({ ctx, input }) => {
      const scanners = ctx.db.prepare(`
        SELECT su.*, p.name as promoter_name
        FROM scanner_users su
        LEFT JOIN promoters p ON su.promoter_id = p.id
        WHERE su.promoter_id = ?
        ORDER BY su.created_at DESC
      `).all(input.promoterId) as any[];

      return scanners.map(s => {
        const eventAccess = ctx.db.prepare(`
          SELECT e.id, e.name FROM scanner_event_access sea
          JOIN events e ON sea.event_id = e.id
          WHERE sea.scanner_id = ?
        `).all(s.id) as any[];

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          promoterId: s.promoter_id,
          promoterName: s.promoter_name,
          events: eventAccess.map(e => ({ id: e.id, name: e.name })),
          isActive: s.is_active === 1,
          createdAt: s.created_at,
        };
      });
    }),

  updateScannerUser: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      isActive: z.boolean().optional(),
      eventIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.name !== undefined) {
        ctx.db.prepare('UPDATE scanner_users SET name = ? WHERE id = ?').run(input.name, input.id);
      }
      if (input.isActive !== undefined) {
        ctx.db.prepare('UPDATE scanner_users SET is_active = ? WHERE id = ?').run(input.isActive ? 1 : 0, input.id);
      }
      if (input.eventIds !== undefined) {
        ctx.db.prepare('DELETE FROM scanner_event_access WHERE scanner_id = ?').run(input.id);
        for (const eventId of input.eventIds) {
          const accessId = `access_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          ctx.db.prepare(`
            INSERT INTO scanner_event_access (id, scanner_id, event_id)
            VALUES (?, ?, ?)
          `).run(accessId, input.id, eventId);
        }
      }
      return { success: true };
    }),

  deleteScannerUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM scanner_users WHERE id = ?').run(input.id);
      return { success: true };
    }),
});
