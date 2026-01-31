import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

export const promotersRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    const promoters = ctx.db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM events WHERE promoter_id = p.id) as event_count,
        (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.promoter_id = p.id) as total_earnings,
        (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.promoter_id = p.id AND t.purchase_date > COALESCE((SELECT MAX(completed_at) FROM promoter_payouts WHERE promoter_id = p.id AND status = 'completed'), '1970-01-01')) as pending_payout
      FROM promoters p
      ORDER BY p.created_at DESC
    `).all() as any[];

    return promoters.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      companyName: p.company_name,
      taxId: p.tax_id,
      stripeAccountId: p.stripe_account_id,
      stripeAccountStatus: p.stripe_account_status,
      commissionPercentage: p.commission_percentage,
      isActive: Boolean(p.is_active),
      createdAt: p.created_at,
      eventCount: p.event_count,
      totalEarnings: p.total_earnings,
      pendingPayout: p.pending_payout,
    }));
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const promoter = ctx.db.prepare(`
        SELECT p.*,
          (SELECT COUNT(*) FROM events WHERE promoter_id = p.id) as event_count,
          (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.promoter_id = p.id) as total_earnings
        FROM promoters p
        WHERE p.id = ?
      `).get(input.id) as any;

      if (!promoter) return null;

      const events = ctx.db.prepare(`
        SELECT e.*,
          (SELECT COUNT(*) FROM tickets WHERE event_id = e.id) as tickets_sold,
          (SELECT COALESCE(SUM(price), 0) FROM tickets WHERE event_id = e.id) as revenue
        FROM events e
        WHERE e.promoter_id = ?
        ORDER BY e.date DESC
      `).all(input.id) as any[];

      const payouts = ctx.db.prepare(`
        SELECT * FROM promoter_payouts WHERE promoter_id = ? ORDER BY created_at DESC LIMIT 20
      `).all(input.id) as any[];

      return {
        id: promoter.id,
        name: promoter.name,
        email: promoter.email,
        phone: promoter.phone,
        companyName: promoter.company_name,
        taxId: promoter.tax_id,
        stripeAccountId: promoter.stripe_account_id,
        stripeAccountStatus: promoter.stripe_account_status,
        commissionPercentage: promoter.commission_percentage,
        isActive: Boolean(promoter.is_active),
        createdAt: promoter.created_at,
        eventCount: promoter.event_count,
        totalEarnings: promoter.total_earnings,
        events: events.map(e => ({
          id: e.id,
          name: e.name,
          date: e.date,
          venue: e.venue,
          ticketsSold: e.tickets_sold,
          revenue: e.revenue,
          isActive: Boolean(e.is_active),
        })),
        payouts: payouts.map(p => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          stripeTransferId: p.stripe_transfer_id,
          createdAt: p.created_at,
          completedAt: p.completed_at,
        })),
      };
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      taxId: z.string().optional(),
      commissionPercentage: z.number().min(0).max(100).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const existing = ctx.db.prepare('SELECT id FROM promoters WHERE email = ?').get(input.email);
      if (existing) throw new Error('Ya existe un promotor con ese email');

      const promoterId = `prm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      ctx.db.prepare(`
        INSERT INTO promoters (id, name, email, phone, company_name, tax_id, commission_percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        promoterId,
        input.name,
        input.email,
        input.phone || null,
        input.companyName || null,
        input.taxId || null,
        input.commissionPercentage ?? 5.0
      );

      return { id: promoterId, success: true };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      taxId: z.string().optional(),
      commissionPercentage: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...updates } = input;
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
      if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
      if (updates.companyName !== undefined) { fields.push('company_name = ?'); values.push(updates.companyName); }
      if (updates.taxId !== undefined) { fields.push('tax_id = ?'); values.push(updates.taxId); }
      if (updates.commissionPercentage !== undefined) { fields.push('commission_percentage = ?'); values.push(updates.commissionPercentage); }
      if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        ctx.db.prepare(`UPDATE promoters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const hasEvents = ctx.db.prepare('SELECT COUNT(*) as count FROM events WHERE promoter_id = ?').get(input.id) as any;
      if (hasEvents.count > 0) {
        throw new Error('No se puede eliminar un promotor con eventos asociados');
      }
      ctx.db.prepare('DELETE FROM promoters WHERE id = ?').run(input.id);
      return { success: true };
    }),

  connectStripe: publicProcedure
    .input(z.object({
      id: z.string(),
      stripeAccountId: z.string(),
    }))
    .mutation(({ ctx, input }) => {
      ctx.db.prepare(`
        UPDATE promoters SET stripe_account_id = ?, stripe_account_status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(input.stripeAccountId, input.id);
      return { success: true };
    }),
});
