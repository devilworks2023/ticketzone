import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import crypto from 'crypto';

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
});
