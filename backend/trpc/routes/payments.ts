import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

export const paymentsRouter = createTRPCRouter({
  createPaymentIntent: publicProcedure
    .input(z.object({
      eventId: z.string(),
      tierId: z.string(),
      quantity: z.number().min(1).max(10),
      buyerName: z.string(),
      buyerEmail: z.string().email(),
      buyerPhone: z.string().optional(),
      sellerCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId) as any;
      if (!tier) throw new Error('Tipo de entrada no encontrado');
      
      const availableTickets = tier.quantity - tier.sold;
      if (availableTickets < input.quantity) {
        throw new Error(`Solo quedan ${availableTickets} entradas disponibles`);
      }

      const event = ctx.db.prepare('SELECT * FROM events WHERE id = ?').get(input.eventId) as any;
      if (!event) throw new Error('Evento no encontrado');

      const totalAmount = tier.price * input.quantity;
      const amountInCents = Math.round(totalAmount * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'eur',
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            eventId: input.eventId,
            eventName: event.name,
            tierId: input.tierId,
            tierName: tier.name,
            quantity: input.quantity.toString(),
            buyerName: input.buyerName,
            buyerEmail: input.buyerEmail,
            buyerPhone: input.buyerPhone || '',
            sellerCode: input.sellerCode || '',
          },
        });

        return {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: totalAmount,
        };
      } catch (error: any) {
        console.error('Stripe error:', error);
        throw new Error(`Error al crear el pago: ${error.message}`);
      }
    }),

  confirmPayment: publicProcedure
    .input(z.object({
      paymentIntentId: z.string(),
      eventId: z.string(),
      tierId: z.string(),
      quantity: z.number().min(1),
      buyerName: z.string(),
      buyerEmail: z.string(),
      buyerPhone: z.string().optional(),
      sellerCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          throw new Error('El pago no se ha completado correctamente');
        }

        const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId) as any;
        if (!tier) throw new Error('Tipo de entrada no encontrado');

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

        const tickets = [];

        for (let i = 0; i < input.quantity; i++) {
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
            'card',
            input.paymentIntentId,
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

          tickets.push({
            id: ticketId,
            qrCode,
            price: tier.price,
          });
        }

        return {
          success: true,
          tickets,
          totalAmount: tier.price * input.quantity,
        };
      } catch (error: any) {
        console.error('Confirm payment error:', error);
        throw new Error(error.message || 'Error al confirmar el pago');
      }
    }),

  getPublishableKey: publicProcedure.query(() => {
    return {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    };
  }),
});
