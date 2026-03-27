import { serve } from '@hono/node-server';
import app from './hono';

const port = parseInt(process.env.PORT || '3001', 10);

console.log('╔═══════════════════════════════════════════╗');
console.log('║     TicketZone Backend Server             ║');
console.log('╚═══════════════════════════════════════════╝');
console.log(`Iniciando servidor en puerto ${port}...`);

serve({
  fetch: app.fetch,
  port,
}, (info: { port: number }) => {
  console.log(`✓ Servidor corriendo en http://localhost:${info.port}`);
  console.log(`✓ API disponible en http://localhost:${info.port}/trpc`);
  console.log(`✓ Health check en http://localhost:${info.port}/health`);
});
