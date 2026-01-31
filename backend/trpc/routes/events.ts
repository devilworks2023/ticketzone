import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

const ticketTierSchema = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  description: z.string().optional(),
  includesBus: z.boolean().optional(),
  isVip: z.boolean().optional(),
});

export const eventsRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    const events = ctx.db.prepare(`
      SELECT e.*, p.name as promoter_name, p.company_name as promoter_company
      FROM events e
      LEFT JOIN promoters p ON e.promoter_id = p.id
      ORDER BY e.date DESC
    `).all() as any[];

    return events.map(event => {
      const tiers = ctx.db.prepare(`
        SELECT * FROM ticket_tiers WHERE event_id = ?
      `).all(event.id) as any[];

      return {
        id: event.id,
        name: event.name,
        date: event.date,
        time: event.time,
        venue: event.venue,
        location: event.location,
        image: event.image,
        description: event.description,
        isActive: Boolean(event.is_active),
        promoterId: event.promoter_id,
        promoterName: event.promoter_name,
        promoterCompany: event.promoter_company,
        createdAt: event.created_at,
        ticketTiers: tiers.map(t => ({
          id: t.id,
          name: t.name,
          price: t.price,
          quantity: t.quantity,
          sold: t.sold,
          description: t.description,
          includesBus: Boolean(t.includes_bus),
          isVip: Boolean(t.is_vip),
        })),
      };
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const event = ctx.db.prepare(`
        SELECT e.*, p.name as promoter_name, p.company_name as promoter_company
        FROM events e
        LEFT JOIN promoters p ON e.promoter_id = p.id
        WHERE e.id = ?
      `).get(input.id) as any;

      if (!event) return null;

      const tiers = ctx.db.prepare(`
        SELECT * FROM ticket_tiers WHERE event_id = ?
      `).all(event.id) as any[];

      return {
        id: event.id,
        name: event.name,
        date: event.date,
        time: event.time,
        venue: event.venue,
        location: event.location,
        image: event.image,
        description: event.description,
        isActive: Boolean(event.is_active),
        promoterId: event.promoter_id,
        promoterName: event.promoter_name,
        promoterCompany: event.promoter_company,
        createdAt: event.created_at,
        ticketTiers: tiers.map(t => ({
          id: t.id,
          name: t.name,
          price: t.price,
          quantity: t.quantity,
          sold: t.sold,
          description: t.description,
          includesBus: Boolean(t.includes_bus),
          isVip: Boolean(t.is_vip),
        })),
      };
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string(),
      date: z.string(),
      time: z.string(),
      venue: z.string(),
      location: z.string(),
      image: z.string().optional(),
      description: z.string().optional(),
      promoterId: z.string().optional(),
      ticketTiers: z.array(ticketTierSchema),
    }))
    .mutation(({ ctx, input }) => {
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      ctx.db.prepare(`
        INSERT INTO events (id, promoter_id, name, date, time, venue, location, image, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        input.promoterId || null,
        input.name,
        input.date,
        input.time,
        input.venue,
        input.location,
        input.image || null,
        input.description || null
      );

      const insertTier = ctx.db.prepare(`
        INSERT INTO ticket_tiers (id, event_id, name, price, quantity, description, includes_bus, is_vip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const tier of input.ticketTiers) {
        const tierId = `tier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        insertTier.run(
          tierId,
          eventId,
          tier.name,
          tier.price,
          tier.quantity,
          tier.description || null,
          tier.includesBus ? 1 : 0,
          tier.isVip ? 1 : 0
        );
      }

      return { id: eventId, success: true };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      venue: z.string().optional(),
      location: z.string().optional(),
      image: z.string().optional(),
      description: z.string().optional(),
      promoterId: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...updates } = input;
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
      if (updates.time !== undefined) { fields.push('time = ?'); values.push(updates.time); }
      if (updates.venue !== undefined) { fields.push('venue = ?'); values.push(updates.venue); }
      if (updates.location !== undefined) { fields.push('location = ?'); values.push(updates.location); }
      if (updates.image !== undefined) { fields.push('image = ?'); values.push(updates.image); }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
      if (updates.promoterId !== undefined) { fields.push('promoter_id = ?'); values.push(updates.promoterId); }
      if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        ctx.db.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM events WHERE id = ?').run(input.id);
      return { success: true };
    }),
});
