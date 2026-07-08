import { trpcServer } from '@hono/trpc-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import fs from 'fs';
import path from 'path';

import { appRouter } from './trpc/app-router';
import { createContext } from './trpc/create-context';

const app = new Hono();

app.use('*', cors());

app.use(
  '/api/trpc/*',
  trpcServer({
    endpoint: '/api/trpc',
    router: appRouter,
    createContext,
  }),
);

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// En producción, `npx expo export -p web` genera un build estático que se sirve
// desde aquí mismo (mismo proceso, mismo puerto que la API). En desarrollo no
// existe ese build, así que `/` responde con un simple JSON de estado.
const webBuildDir = process.env.WEB_BUILD_DIR || 'web-build';
const webBuildIndex = path.join(process.cwd(), webBuildDir, 'index.html');
const hasWebBuild = fs.existsSync(webBuildIndex);

if (hasWebBuild) {
  app.use('/*', serveStatic({ root: webBuildDir }));
  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.html(fs.readFileSync(webBuildIndex, 'utf-8'));
  });
} else {
  app.get('/', (c) => {
    return c.json({ status: 'ok', message: 'MusicLab AI backend está en línea (sin build web)', version: '1.0.0' });
  });
}

export default app;
