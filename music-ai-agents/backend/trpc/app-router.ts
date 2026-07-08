import { createTRPCRouter } from './create-context';
import { tracksRouter } from './routes/tracks';

export const appRouter = createTRPCRouter({
  tracks: tracksRouter,
});

export type AppRouter = typeof appRouter;
