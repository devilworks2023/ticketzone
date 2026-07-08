import { serve } from '@hono/node-server';
import app from './hono';

const port = parseInt(process.env.PORT || '3002', 10);

console.log('╔═══════════════════════════════════════════╗');
console.log('║     MusicLab AI Backend Server            ║');
console.log('╚═══════════════════════════════════════════╝');
console.log(`Iniciando servidor en puerto ${port}...`);

serve({
  fetch: app.fetch,
  port,
}, (info: { port: number }) => {
  console.log(`✓ Servidor corriendo en http://localhost:${info.port}`);
  console.log(`✓ API disponible en http://localhost:${info.port}/api/trpc`);
  console.log(`✓ Health check en http://localhost:${info.port}/health`);
});
