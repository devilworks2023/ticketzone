import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

export const settingsRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    const settings = ctx.db.prepare('SELECT * FROM settings').all() as any[];
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }),

  get: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(({ ctx, input }) => {
      const setting = ctx.db.prepare('SELECT value FROM settings WHERE key = ?').get(input.key) as any;
      return setting?.value || null;
    }),

  set: publicProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
    }))
    .mutation(({ ctx, input }) => {
      ctx.db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(input.key, input.value);
      return { success: true };
    }),

  setMultiple: publicProcedure
    .input(z.record(z.string(), z.string()))
    .mutation(({ ctx, input }) => {
      const stmt = ctx.db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);

      // Usar transacción para asegurar que todos los cambios se guarden
      const saveAll = ctx.db.transaction(() => {
        for (const [key, value] of Object.entries(input)) {
          console.log(`[SETTINGS] Guardando: ${key} = ${value}`);
          stmt.run(key, value);
        }
      });
      
      saveAll();
      
      // Forzar WAL checkpoint para asegurar que los datos se escriban al disco
      try {
        ctx.db.pragma('wal_checkpoint(TRUNCATE)');
        console.log('[SETTINGS] WAL checkpoint completado');
      } catch (e) {
        console.log('[SETTINGS] WAL checkpoint error (ignorable):', e);
      }
      
      // Verificar que se guardaron
      const saved = ctx.db.prepare('SELECT * FROM settings').all() as any[];
      console.log('[SETTINGS] Valores guardados en DB:', JSON.stringify(saved));

      return { success: true };
    }),

  debug: publicProcedure.query(({ ctx }) => {
    const settings = ctx.db.prepare('SELECT * FROM settings').all() as any[];
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return {
      dbPath: 'SQLite Database',
      settings: result,
      timestamp: new Date().toISOString(),
    };
  }),
});
