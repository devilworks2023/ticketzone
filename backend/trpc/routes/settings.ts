import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

export const settingsRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    console.log('[SETTINGS] getAll called');
    try {
      const settings = ctx.db.prepare('SELECT * FROM settings').all() as any[];
      const result: Record<string, string> = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }
      console.log('[SETTINGS] Returning:', JSON.stringify(result));
      return result;
    } catch (error: any) {
      console.error('[SETTINGS] Error en getAll:', error);
      throw new Error('Error al obtener configuración: ' + error.message);
    }
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
      console.log(`[SETTINGS] set: ${input.key} = ${input.value}`);
      try {
        ctx.db.prepare(`
          INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(input.key, String(input.value));
        
        ctx.db.pragma('wal_checkpoint(TRUNCATE)');
        
        const saved = ctx.db.prepare('SELECT value FROM settings WHERE key = ?').get(input.key) as any;
        console.log(`[SETTINGS] Verificado: ${input.key} = ${saved?.value}`);
        
        return { success: true, savedValue: saved?.value };
      } catch (error: any) {
        console.error('[SETTINGS] Error en set:', error);
        throw new Error('Error al guardar: ' + error.message);
      }
    }),

  setMultiple: publicProcedure
    .input(z.record(z.string(), z.string()))
    .mutation(({ ctx, input }) => {
      console.log('');
      console.log('========================================');
      console.log('[SETTINGS] SETMULTIPLE - Guardando configuración');
      console.log('========================================');
      console.log('[SETTINGS] Datos recibidos:', JSON.stringify(input, null, 2));
      
      try {
        // Guardar cada setting uno por uno (más simple y confiable)
        for (const [key, value] of Object.entries(input)) {
          console.log(`[SETTINGS] Guardando: ${key} = ${value}`);
          ctx.db.prepare(`
            INSERT INTO settings (key, value, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET 
              value = excluded.value, 
              updated_at = CURRENT_TIMESTAMP
          `).run(key, String(value));
        }
        
        // Forzar escritura al disco
        try {
          ctx.db.pragma('wal_checkpoint(TRUNCATE)');
          console.log('[SETTINGS] WAL checkpoint completado');
        } catch (e) {
          console.log('[SETTINGS] WAL checkpoint warning:', e);
        }
        
        // Verificar que se guardaron correctamente
        const allSettings = ctx.db.prepare('SELECT key, value FROM settings').all() as any[];
        const savedValues: Record<string, string> = {};
        for (const s of allSettings) {
          savedValues[s.key] = s.value;
        }
        
        console.log('');
        console.log('[SETTINGS] VERIFICACIÓN - Valores en DB:');
        let allOk = true;
        for (const [key, value] of Object.entries(input)) {
          const saved = savedValues[key];
          const match = saved === String(value);
          if (!match) allOk = false;
          console.log(`  ${match ? '✓' : '✗'} ${key}: "${saved}" (esperado: "${value}")`);
        }
        console.log('========================================');
        console.log('');
        
        if (!allOk) {
          console.error('[SETTINGS] ERROR: Algunos valores no coinciden');
          throw new Error('Algunos valores no se guardaron correctamente');
        }
        
        return { success: true, savedValues };
      } catch (error: any) {
        console.error('[SETTINGS] ERROR al guardar:', error);
        console.error('[SETTINGS] Stack:', error.stack);
        throw new Error('Error al guardar configuración: ' + error.message);
      }
    }),

  debug: publicProcedure.query(({ ctx }) => {
    try {
      const settings = ctx.db.prepare('SELECT * FROM settings').all() as any[];
      const result: Record<string, string> = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }
      return {
        dbPath: process.env.DATABASE_PATH || 'unknown',
        settingsCount: settings.length,
        settings: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }),
});
