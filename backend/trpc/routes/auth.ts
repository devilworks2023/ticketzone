import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import crypto from 'crypto';

function generateInvitationCode(): string {
  return 'INV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.db.prepare(`
        SELECT * FROM users WHERE email = ? AND is_active = 1
      `).get(input.email.toLowerCase()) as any;

      if (!user) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      if (!verifyPassword(input.password, user.password_hash)) {
        throw new Error('Contraseña incorrecta');
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.enum(['admin', 'seller']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase()) as any;
      
      if (existing) {
        throw new Error('Este email ya está registrado');
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = hashPassword(input.password);

      ctx.db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(userId, input.email.toLowerCase(), passwordHash, input.name, input.role || 'admin');

      return {
        success: true,
        user: {
          id: userId,
          email: input.email.toLowerCase(),
          name: input.name,
          role: input.role || 'admin',
        },
      };
    }),

  getUsers: publicProcedure.query(({ ctx }) => {
    const users = ctx.db.prepare(`
      SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at DESC
    `).all() as any[];

    return users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.is_active === 1,
      createdAt: u.created_at,
    }));
  }),

  updateUser: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      role: z.enum(['admin', 'seller']).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: string[] = [];
      const values: any[] = [];

      if (input.name !== undefined) {
        updates.push('name = ?');
        values.push(input.name);
      }
      if (input.role !== undefined) {
        updates.push('role = ?');
        values.push(input.role);
      }
      if (input.isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(input.isActive ? 1 : 0);
      }
      if (input.password !== undefined) {
        updates.push('password_hash = ?');
        values.push(hashPassword(input.password));
      }

      if (updates.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      values.push(input.id);
      ctx.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      return { success: true };
    }),

  deleteUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM users WHERE id = ?').run(input.id);
      return { success: true };
    }),

  getProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ ctx, input }) => {
      const user = ctx.db.prepare(`
        SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ?
      `).get(input.userId) as any;

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
      };
    }),

  registerUser: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase()) as any;
      
      if (existing) {
        throw new Error('Este email ya está registrado');
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = hashPassword(input.password);

      ctx.db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, is_active)
        VALUES (?, ?, ?, ?, 'buyer', 1)
      `).run(userId, input.email.toLowerCase(), passwordHash, input.name);

      return {
        success: true,
        user: {
          id: userId,
          email: input.email.toLowerCase(),
          name: input.name,
          role: 'buyer',
        },
      };
    }),

  registerWithInvitation: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      phone: z.string().optional(),
      invitationCode: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const invitation = ctx.db.prepare(`
        SELECT * FROM invitation_codes 
        WHERE code = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (max_uses = 0 OR current_uses < max_uses)
      `).get(input.invitationCode.toUpperCase()) as any;

      if (!invitation) {
        throw new Error('Código de invitación inválido, expirado o agotado');
      }

      const existingUser = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase()) as any;
      if (existingUser) {
        throw new Error('Este email ya está registrado');
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = hashPassword(input.password);

      ctx.db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(userId, input.email.toLowerCase(), passwordHash, input.name, invitation.type);

      if (invitation.type === 'promoter') {
        const promoterId = `promoter_${Date.now()}`;
        ctx.db.prepare(`
          INSERT INTO promoters (id, name, email, phone, is_active)
          VALUES (?, ?, ?, ?, 1)
        `).run(promoterId, input.name, input.email.toLowerCase(), input.phone || null);
      } else if (invitation.type === 'seller') {
        const sellerId = `seller_${Date.now()}`;
        const sellerCode = 'RRPP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        ctx.db.prepare(`
          INSERT INTO sellers (id, name, email, phone, code, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(sellerId, input.name, input.email.toLowerCase(), input.phone || null, sellerCode);
      }

      ctx.db.prepare(`
        UPDATE invitation_codes SET current_uses = current_uses + 1 WHERE id = ?
      `).run(invitation.id);

      return {
        success: true,
        user: {
          id: userId,
          email: input.email.toLowerCase(),
          name: input.name,
          role: invitation.type,
        },
      };
    }),

  createInvitationCode: publicProcedure
    .input(z.object({
      type: z.enum(['promoter', 'seller']),
      maxUses: z.number().min(0).default(1),
      expiresInDays: z.number().min(0).optional(),
      createdBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = `inv_${Date.now()}`;
      const code = generateInvitationCode();
      const expiresAt = input.expiresInDays 
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      ctx.db.prepare(`
        INSERT INTO invitation_codes (id, code, type, max_uses, expires_at, created_by, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(id, code, input.type, input.maxUses, expiresAt, input.createdBy);

      return { success: true, code, id };
    }),

  getInvitationCodes: publicProcedure.query(({ ctx }) => {
    const codes = ctx.db.prepare(`
      SELECT ic.*, u.name as created_by_name 
      FROM invitation_codes ic
      LEFT JOIN users u ON ic.created_by = u.id
      ORDER BY ic.created_at DESC
    `).all() as any[];

    return codes.map(c => ({
      id: c.id,
      code: c.code,
      type: c.type,
      maxUses: c.max_uses,
      currentUses: c.current_uses,
      expiresAt: c.expires_at,
      createdBy: c.created_by_name || 'Sistema',
      isActive: c.is_active === 1,
      createdAt: c.created_at,
    }));
  }),

  deleteInvitationCode: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM invitation_codes WHERE id = ?').run(input.id);
      return { success: true };
    }),

  toggleInvitationCode: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('UPDATE invitation_codes SET is_active = ? WHERE id = ?').run(input.isActive ? 1 : 0, input.id);
      return { success: true };
    }),

  validateInvitationCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(({ ctx, input }) => {
      const invitation = ctx.db.prepare(`
        SELECT type FROM invitation_codes 
        WHERE code = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (max_uses = 0 OR current_uses < max_uses)
      `).get(input.code.toUpperCase()) as any;

      return {
        valid: !!invitation,
        type: invitation?.type || null,
      };
    }),

  updateProfile: publicProcedure
    .input(z.object({
      userId: z.string(),
      name: z.string().optional(),
      phone: z.string().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(input.userId) as any;
      if (!user) throw new Error('Usuario no encontrado');

      if (input.newPassword) {
        if (!input.currentPassword) {
          throw new Error('Debes proporcionar la contraseña actual');
        }
        if (!verifyPassword(input.currentPassword, user.password_hash)) {
          throw new Error('Contraseña actual incorrecta');
        }
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (input.name !== undefined) {
        updates.push('name = ?');
        values.push(input.name);
      }
      if (input.newPassword) {
        updates.push('password_hash = ?');
        values.push(hashPassword(input.newPassword));
      }

      if (updates.length > 0) {
        values.push(input.userId);
        ctx.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      return { success: true };
    }),
});
