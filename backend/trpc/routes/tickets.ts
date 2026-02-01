import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

export const ticketsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ eventId: z.string().optional() }).optional())
    .query(({ ctx, input }) => {
      let query = `
        SELECT t.*, e.name as event_name, tt.name as tier_name, s.name as seller_name
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN ticket_tiers tt ON t.tier_id = tt.id
        LEFT JOIN sellers s ON t.seller_id = s.id
      `;
      const params: any[] = [];

      if (input?.eventId) {
        query += ' WHERE t.event_id = ?';
        params.push(input.eventId);
      }

      query += ' ORDER BY t.purchase_date DESC';

      const tickets = ctx.db.prepare(query).all(...params) as any[];

      return tickets.map(t => ({
        id: t.id,
        eventId: t.event_id,
        eventName: t.event_name,
        tierId: t.tier_id,
        tierName: t.tier_name,
        buyerName: t.buyer_name,
        buyerEmail: t.buyer_email,
        buyerPhone: t.buyer_phone,
        qrCode: t.qr_code,
        purchaseDate: t.purchase_date,
        sellerId: t.seller_id,
        sellerName: t.seller_name,
        sellerCode: t.seller_code,
        isUsed: Boolean(t.is_used),
        usedAt: t.used_at,
        paymentMethod: t.payment_method,
        price: t.price,
        platformFee: t.platform_fee,
        promoterAmount: t.promoter_amount,
        sellerCommission: t.seller_commission,
      }));
    }),

  create: publicProcedure
    .input(z.object({
      eventId: z.string(),
      tierId: z.string(),
      buyerName: z.string(),
      buyerEmail: z.string(),
      buyerPhone: z.string().optional(),
      sellerCode: z.string().optional(),
      paymentMethod: z.enum(['card', 'googlepay', 'applepay', 'cash']),
      paymentIntentId: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId) as any;
      if (!tier) throw new Error('Tipo de entrada no encontrado');
      if (tier.sold >= tier.quantity) throw new Error('Entradas agotadas');

      const event = ctx.db.prepare('SELECT * FROM events WHERE id = ?').get(input.eventId) as any;
      if (!event) throw new Error('Evento no encontrado');

      let seller: any = null;
      let sellerCommission = 0;

      if (input.sellerCode) {
        seller = ctx.db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(input.sellerCode.toUpperCase()) as any;
        if (seller) {
          const commissions = ctx.db.prepare(`
            SELECT * FROM seller_commissions 
            WHERE seller_id = ? 
            ORDER BY min_sales ASC
          `).all(seller.id) as any[];

          for (const comm of commissions) {
            if (seller.total_sales >= comm.min_sales && (comm.max_sales === null || seller.total_sales < comm.max_sales)) {
              sellerCommission = tier.price * (comm.percentage / 100);
              break;
            }
          }
        }
      }

      const platformCommission = ctx.db.prepare("SELECT value FROM settings WHERE key = 'platform_commission'").get() as any;
      const platformFee = tier.price * ((parseFloat(platformCommission?.value || '5') / 100));
      const promoterAmount = tier.price - platformFee - sellerCommission;

      const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const qrCode = `${input.eventId}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      ctx.db.prepare(`
        INSERT INTO tickets (
          id, event_id, tier_id, buyer_name, buyer_email, buyer_phone,
          qr_code, seller_id, seller_code, payment_method, payment_intent_id,
          price, platform_fee, promoter_amount, seller_commission
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticketId,
        input.eventId,
        input.tierId,
        input.buyerName,
        input.buyerEmail,
        input.buyerPhone || null,
        qrCode,
        seller?.id || null,
        input.sellerCode?.toUpperCase() || null,
        input.paymentMethod,
        input.paymentIntentId || null,
        tier.price,
        platformFee,
        promoterAmount,
        sellerCommission
      );

      ctx.db.prepare('UPDATE ticket_tiers SET sold = sold + 1 WHERE id = ?').run(input.tierId);

      if (seller) {
        ctx.db.prepare(`
          UPDATE sellers SET total_sales = total_sales + 1, total_revenue = total_revenue + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(tier.price, seller.id);
      }

      return {
        id: ticketId,
        qrCode,
        price: tier.price,
        success: true,
      };
    }),

  validate: publicProcedure
    .input(z.object({ qrCode: z.string() }))
    .mutation(({ ctx, input }) => {
      const ticket = ctx.db.prepare(`
        SELECT t.*, e.name as event_name, tt.name as tier_name
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN ticket_tiers tt ON t.tier_id = tt.id
        WHERE t.qr_code = ?
      `).get(input.qrCode) as any;

      if (!ticket) {
        return { success: false, message: 'Entrada no encontrada' };
      }

      if (ticket.is_used) {
        return {
          success: false,
          message: `Entrada ya usada el ${new Date(ticket.used_at).toLocaleString('es-ES')}`,
          ticket: {
            id: ticket.id,
            eventName: ticket.event_name,
            tierName: ticket.tier_name,
            buyerName: ticket.buyer_name,
            isUsed: true,
            usedAt: ticket.used_at,
          },
        };
      }

      ctx.db.prepare(`
        UPDATE tickets SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(ticket.id);

      return {
        success: true,
        message: 'Entrada válida ✓',
        ticket: {
          id: ticket.id,
          eventName: ticket.event_name,
          tierName: ticket.tier_name,
          buyerName: ticket.buyer_name,
          isUsed: true,
          usedAt: new Date().toISOString(),
        },
      };
    }),

  getByQr: publicProcedure
    .input(z.object({ qrCode: z.string() }))
    .query(({ ctx, input }) => {
      const ticket = ctx.db.prepare(`
        SELECT t.*, e.name as event_name, e.date as event_date, e.venue, tt.name as tier_name
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN ticket_tiers tt ON t.tier_id = tt.id
        WHERE t.qr_code = ?
      `).get(input.qrCode) as any;

      if (!ticket) return null;

      return {
        id: ticket.id,
        eventName: ticket.event_name,
        eventDate: ticket.event_date,
        venue: ticket.venue,
        tierName: ticket.tier_name,
        buyerName: ticket.buyer_name,
        buyerEmail: ticket.buyer_email,
        qrCode: ticket.qr_code,
        isUsed: Boolean(ticket.is_used),
        usedAt: ticket.used_at,
        price: ticket.price,
      };
    }),

  listAll: publicProcedure
    .query(({ ctx }) => {
      const tickets = ctx.db.prepare(`
        SELECT t.*, e.name as event_name, tt.name as tier_name, s.name as seller_name
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN ticket_tiers tt ON t.tier_id = tt.id
        LEFT JOIN sellers s ON t.seller_id = s.id
        ORDER BY t.purchase_date DESC
        LIMIT 500
      `).all() as any[];

      return tickets.map(t => ({
        id: t.id,
        eventId: t.event_id,
        eventName: t.event_name,
        tierId: t.tier_id,
        tierName: t.tier_name,
        buyerName: t.buyer_name,
        buyerEmail: t.buyer_email,
        buyerPhone: t.buyer_phone,
        qrCode: t.qr_code,
        purchaseDate: t.purchase_date,
        sellerId: t.seller_id,
        sellerName: t.seller_name,
        sellerCode: t.seller_code,
        isUsed: Boolean(t.is_used),
        usedAt: t.used_at,
        paymentMethod: t.payment_method,
        price: t.price,
      }));
    }),

  getByEmail: publicProcedure
    .input(z.object({ email: z.string() }))
    .query(({ ctx, input }) => {
      const tickets = ctx.db.prepare(`
        SELECT t.*, e.name as event_name, e.date as event_date, e.time as event_time, e.venue, tt.name as tier_name
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN ticket_tiers tt ON t.tier_id = tt.id
        WHERE LOWER(t.buyer_email) = LOWER(?)
        ORDER BY t.purchase_date DESC
      `).all(input.email) as any[];

      return tickets.map(t => ({
        id: t.id,
        eventId: t.event_id,
        eventName: t.event_name,
        eventDate: t.event_date,
        eventTime: t.event_time,
        venue: t.venue,
        tierName: t.tier_name,
        buyerName: t.buyer_name,
        buyerEmail: t.buyer_email,
        qrCode: t.qr_code,
        purchaseDate: t.purchase_date,
        isUsed: Boolean(t.is_used),
        usedAt: t.used_at,
        price: t.price,
      }));
    }),
});
