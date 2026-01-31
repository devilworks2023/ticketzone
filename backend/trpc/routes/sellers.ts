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
});
