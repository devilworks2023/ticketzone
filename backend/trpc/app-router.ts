import { createTRPCRouter } from './create-context';
import { eventsRouter } from './routes/events';
import { ticketsRouter } from './routes/tickets';
import { sellersRouter } from './routes/sellers';
import { promotersRouter } from './routes/promoters';
import { statsRouter } from './routes/stats';
import { settingsRouter } from './routes/settings';

export const appRouter = createTRPCRouter({
  events: eventsRouter,
  tickets: ticketsRouter,
  sellers: sellersRouter,
  promoters: promotersRouter,
  stats: statsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
