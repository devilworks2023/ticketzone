import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

export const statsRouter = createTRPCRouter({
  dashboard: publicProcedure.query(({ ctx }) => {
    const today = new Date().toISOString().split('T')[0];

    const totalStats = ctx.db.prepare(`
      SELECT 
        COUNT(*) as total_tickets,
        COALESCE(SUM(price), 0) as total_revenue,
        COALESCE(SUM(platform_fee), 0) as platform_earnings
      FROM tickets
    `).get() as any;

    const todayStats = ctx.db.prepare(`
      SELECT 
        COUNT(*) as today_tickets,
        COALESCE(SUM(price), 0) as today_revenue
      FROM tickets
      WHERE DATE(purchase_date) = ?
    `).get(today) as any;

    const eventStats = ctx.db.prepare(`
      SELECT COUNT(*) as total_events FROM events
    `).get() as any;

    const activeEvents = ctx.db.prepare(`
      SELECT COUNT(*) as active_events FROM events WHERE is_active = 1
    `).get() as any;

    const sellerStats = ctx.db.prepare(`
      SELECT COUNT(*) as total_sellers FROM sellers WHERE is_active = 1
    `).get() as any;

    const promoterStats = ctx.db.prepare(`
      SELECT COUNT(*) as total_promoters FROM promoters WHERE is_active = 1
    `).get() as any;

    const recentTickets = ctx.db.prepare(`
      SELECT t.id, t.buyer_name, t.price, t.purchase_date, e.name as event_name
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      ORDER BY t.purchase_date DESC
      LIMIT 10
    `).all() as any[];

    const topEvents = ctx.db.prepare(`
      SELECT e.id, e.name, e.date,
        COUNT(t.id) as tickets_sold,
        COALESCE(SUM(t.price), 0) as revenue
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      GROUP BY e.id
      ORDER BY revenue DESC
      LIMIT 5
    `).all() as any[];

    const topSellers = ctx.db.prepare(`
      SELECT id, name, code, total_sales, total_revenue
      FROM sellers
      WHERE is_active = 1
      ORDER BY total_revenue DESC
      LIMIT 5
    `).all() as any[];

    return {
      totalRevenue: totalStats.total_revenue,
      totalTicketsSold: totalStats.total_tickets,
      platformEarnings: totalStats.platform_earnings,
      todayRevenue: todayStats.today_revenue,
      todayTickets: todayStats.today_tickets,
      totalEvents: eventStats.total_events,
      activeEvents: activeEvents.active_events,
      totalSellers: sellerStats.total_sellers,
      totalPromoters: promoterStats.total_promoters,
      recentTickets: recentTickets.map(t => ({
        id: t.id,
        buyerName: t.buyer_name,
        price: t.price,
        purchaseDate: t.purchase_date,
        eventName: t.event_name,
      })),
      topEvents: topEvents.map(e => ({
        id: e.id,
        name: e.name,
        date: e.date,
        ticketsSold: e.tickets_sold,
        revenue: e.revenue,
      })),
      topSellers: topSellers.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        totalSales: s.total_sales,
        totalRevenue: s.total_revenue,
      })),
    };
  }),

  getDashboardStats: publicProcedure.query(({ ctx }) => {
    const totalStats = ctx.db.prepare(`
      SELECT 
        COUNT(*) as total_tickets,
        COALESCE(SUM(price), 0) as total_revenue
      FROM tickets
    `).get() as any;

    const eventStats = ctx.db.prepare(`
      SELECT COUNT(*) as total_events FROM events
    `).get() as any;

    const activeEvents = ctx.db.prepare(`
      SELECT COUNT(*) as active_events FROM events WHERE is_active = 1
    `).get() as any;

    return {
      totalRevenue: totalStats.total_revenue,
      totalTicketsSold: totalStats.total_tickets,
      totalEvents: eventStats.total_events,
      activeEvents: activeEvents.active_events,
    };
  }),

  eventStats: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(({ ctx, input }) => {
      const event = ctx.db.prepare('SELECT * FROM events WHERE id = ?').get(input.eventId) as any;
      if (!event) return null;

      const ticketStats = ctx.db.prepare(`
        SELECT 
          COUNT(*) as total_sold,
          COALESCE(SUM(price), 0) as total_revenue,
          COUNT(CASE WHEN is_used = 1 THEN 1 END) as checked_in
        FROM tickets
        WHERE event_id = ?
      `).get(input.eventId) as any;

      const tierStats = ctx.db.prepare(`
        SELECT tt.id, tt.name, tt.price, tt.quantity, tt.sold,
          (tt.quantity - tt.sold) as available
        FROM ticket_tiers tt
        WHERE tt.event_id = ?
      `).all(input.eventId) as any[];

      const salesByDay = ctx.db.prepare(`
        SELECT DATE(purchase_date) as date, COUNT(*) as count, SUM(price) as revenue
        FROM tickets
        WHERE event_id = ?
        GROUP BY DATE(purchase_date)
        ORDER BY date DESC
        LIMIT 30
      `).all(input.eventId) as any[];

      const salesByMethod = ctx.db.prepare(`
        SELECT payment_method, COUNT(*) as count, SUM(price) as revenue
        FROM tickets
        WHERE event_id = ?
        GROUP BY payment_method
      `).all(input.eventId) as any[];

      return {
        eventId: event.id,
        eventName: event.name,
        totalSold: ticketStats.total_sold,
        totalRevenue: ticketStats.total_revenue,
        checkedIn: ticketStats.checked_in,
        checkInPercentage: ticketStats.total_sold > 0 ? (ticketStats.checked_in / ticketStats.total_sold) * 100 : 0,
        tierStats: tierStats.map(t => ({
          id: t.id,
          name: t.name,
          price: t.price,
          quantity: t.quantity,
          sold: t.sold,
          available: t.available,
          soldPercentage: t.quantity > 0 ? (t.sold / t.quantity) * 100 : 0,
        })),
        salesByDay,
        salesByMethod: salesByMethod.map(s => ({
          method: s.payment_method,
          count: s.count,
          revenue: s.revenue,
        })),
      };
    }),
});
