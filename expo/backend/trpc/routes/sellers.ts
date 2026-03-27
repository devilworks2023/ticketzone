import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

const commissionTierSchema = z.object({
  minSales: z.number(),
  maxSales: z.number().nullable(),
  percentage: z.number(),
});

export const sellersRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    const sellers = ctx.db.prepare('SELECT * FROM sellers ORDER BY created_at DESC').all() as any[];

    return sellers.map(seller => {
      const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id) as any[];

      return {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        code: seller.code,
        totalSales: seller.total_sales,
        totalRevenue: seller.total_revenue,
        isActive: Boolean(seller.is_active),
        createdAt: seller.created_at,
        commissionTiers: commissions.map(c => ({
          minSales: c.min_sales,
          maxSales: c.max_sales,
          percentage: c.percentage,
        })),
      };
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const seller = ctx.db.prepare('SELECT * FROM sellers WHERE id = ?').get(input.id) as any;
      if (!seller) return null;

      const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id) as any[];
      const tickets = ctx.db.prepare(`
        SELECT t.*, e.name as event_name, tt.name as tier_name
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN ticket_tiers tt ON t.tier_id = tt.id
        WHERE t.seller_id = ?
        ORDER BY t.purchase_date DESC
        LIMIT 50
      `).all(seller.id) as any[];

      return {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        code: seller.code,
        totalSales: seller.total_sales,
        totalRevenue: seller.total_revenue,
        isActive: Boolean(seller.is_active),
        createdAt: seller.created_at,
        commissionTiers: commissions.map(c => ({
          minSales: c.min_sales,
          maxSales: c.max_sales,
          percentage: c.percentage,
        })),
        recentSales: tickets.map(t => ({
          id: t.id,
          eventName: t.event_name,
          tierName: t.tier_name,
          buyerName: t.buyer_name,
          price: t.price,
          purchaseDate: t.purchase_date,
        })),
      };
    }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(({ ctx, input }) => {
      const seller = ctx.db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(input.code.toUpperCase()) as any;
      if (!seller) return null;

      return {
        id: seller.id,
        name: seller.name,
        code: seller.code,
      };
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      code: z.string(),
      commissionTiers: z.array(commissionTierSchema).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const existing = ctx.db.prepare('SELECT id FROM sellers WHERE code = ? OR email = ?').get(input.code.toUpperCase(), input.email);
      if (existing) throw new Error('Ya existe un vendedor con ese código o email');

      const sellerId = `sel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      ctx.db.prepare(`
        INSERT INTO sellers (id, name, email, phone, code) VALUES (?, ?, ?, ?, ?)
      `).run(sellerId, input.name, input.email, input.phone || null, input.code.toUpperCase());

      const defaultTiers = input.commissionTiers || [
        { minSales: 0, maxSales: 10, percentage: 5 },
        { minSales: 10, maxSales: 50, percentage: 7 },
        { minSales: 50, maxSales: null, percentage: 10 },
      ];

      const insertCommission = ctx.db.prepare(`
        INSERT INTO seller_commissions (id, seller_id, min_sales, max_sales, percentage)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const tier of defaultTiers) {
        const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        insertCommission.run(commId, sellerId, tier.minSales, tier.maxSales, tier.percentage);
      }

      return { id: sellerId, code: input.code.toUpperCase(), success: true };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      isActive: z.boolean().optional(),
      commissionTiers: z.array(commissionTierSchema).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, commissionTiers, ...updates } = input;
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
      if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
      if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        ctx.db.prepare(`UPDATE sellers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      if (commissionTiers) {
        ctx.db.prepare('DELETE FROM seller_commissions WHERE seller_id = ?').run(id);
        const insertCommission = ctx.db.prepare(`
          INSERT INTO seller_commissions (id, seller_id, min_sales, max_sales, percentage)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const tier of commissionTiers) {
          const commId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          insertCommission.run(commId, id, tier.minSales, tier.maxSales, tier.percentage);
        }
      }

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM sellers WHERE id = ?').run(input.id);
      return { success: true };
    }),

  login: publicProcedure
    .input(z.object({ code: z.string() }))
    .mutation(({ ctx, input }) => {
      const seller = ctx.db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(input.code.toUpperCase()) as any;
      if (!seller) {
        throw new Error('Código de vendedor no válido o inactivo');
      }

      return {
        success: true,
        seller: {
          id: seller.id,
          name: seller.name,
          code: seller.code,
          email: seller.email,
        },
      };
    }),

  getDashboard: publicProcedure
    .input(z.object({ sellerId: z.string() }))
    .query(({ ctx, input }) => {
      const seller = ctx.db.prepare('SELECT * FROM sellers WHERE id = ?').get(input.sellerId) as any;
      if (!seller) throw new Error('Vendedor no encontrado');

      const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(input.sellerId) as any[];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const getStats = (startDate: string | null) => {
        let query = `
          SELECT COUNT(*) as sales, COALESCE(SUM(price), 0) as revenue, COALESCE(SUM(seller_commission), 0) as commission
          FROM tickets WHERE seller_id = ?`;
        const params: any[] = [input.sellerId];
        if (startDate) {
          query += ' AND purchase_date >= ?';
          params.push(startDate);
        }
        return ctx.db.prepare(query).get(...params) as { sales: number; revenue: number; commission: number };
      };

      const todayStats = getStats(todayStart);
      const weekStats = getStats(weekStart);
      const monthStats = getStats(monthStart);
      const totalStats = getStats(null);

      const salesByEvent = ctx.db.prepare(`
        SELECT e.id, e.name as eventName, e.date as eventDate, e.venue,
               COUNT(t.id) as ticketsSold, COALESCE(SUM(t.seller_commission), 0) as commission
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE t.seller_id = ?
        GROUP BY e.id
        ORDER BY e.date DESC
      `).all(input.sellerId) as any[];

      const currentCommission = commissions.find(c =>
        seller.total_sales >= c.min_sales && (c.max_sales === null || seller.total_sales < c.max_sales)
      );

      const nextTier = commissions.find(c => c.min_sales > seller.total_sales);

      return {
        seller: {
          id: seller.id,
          name: seller.name,
          code: seller.code,
          totalSales: seller.total_sales || 0,
          totalRevenue: seller.total_revenue || 0,
        },
        currentCommissionPercent: currentCommission?.percentage || 5,
        nextTier: nextTier ? {
          minSales: nextTier.min_sales,
          percentage: nextTier.percentage,
          salesNeeded: nextTier.min_sales - (seller.total_sales || 0),
        } : null,
        stats: {
          today: { sales: todayStats.sales, revenue: todayStats.revenue, commission: todayStats.commission },
          week: { sales: weekStats.sales, revenue: weekStats.revenue, commission: weekStats.commission },
          month: { sales: monthStats.sales, revenue: monthStats.revenue, commission: monthStats.commission },
          total: { sales: totalStats.sales, revenue: totalStats.revenue, commission: totalStats.commission },
        },
        salesByEvent: salesByEvent.map(e => ({
          id: e.id,
          eventName: e.eventName,
          eventDate: e.eventDate,
          venue: e.venue,
          ticketsSold: e.ticketsSold,
          commission: e.commission,
        })),
        commissionTiers: commissions.map(c => ({
          minSales: c.min_sales,
          maxSales: c.max_sales,
          percentage: c.percentage,
        })),
      };
    }),

  getSalesHistory: publicProcedure
    .input(z.object({ sellerId: z.string(), limit: z.number().optional() }))
    .query(({ ctx, input }) => {
      const limit = input.limit || 100;

      const tickets = ctx.db.prepare(`
        SELECT t.*, e.name as event_name, e.date as event_date, e.venue, tt.name as tier_name
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN ticket_tiers tt ON t.tier_id = tt.id
        WHERE t.seller_id = ?
        ORDER BY t.purchase_date DESC
        LIMIT ?
      `).all(input.sellerId, limit) as any[];

      return {
        tickets: tickets.map(t => ({
          id: t.id,
          eventName: t.event_name,
          eventDate: t.event_date,
          venue: t.venue,
          tierName: t.tier_name,
          buyerName: t.buyer_name,
          buyerEmail: t.buyer_email,
          price: t.price,
          sellerCommission: t.seller_commission || 0,
          purchaseDate: t.purchase_date,
          isUsed: Boolean(t.is_used),
        })),
      };
    }),
});
