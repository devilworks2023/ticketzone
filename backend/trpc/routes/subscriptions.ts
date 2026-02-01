import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

export const subscriptionsRouter = createTRPCRouter({
  listPlans: publicProcedure.query(({ ctx }) => {
    const plans = ctx.db.prepare(`
      SELECT * FROM subscription_plans 
      WHERE is_active = 1 
      ORDER BY sort_order ASC
    `).all() as any[];

    return plans.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      maxEventsPerMonth: p.max_events_per_month,
      priceMonthly: p.price_monthly,
      isActive: Boolean(p.is_active),
      sortOrder: p.sort_order,
    }));
  }),

  listAllPlans: publicProcedure.query(({ ctx }) => {
    const plans = ctx.db.prepare(`
      SELECT * FROM subscription_plans 
      ORDER BY sort_order ASC
    `).all() as any[];

    return plans.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      maxEventsPerMonth: p.max_events_per_month,
      priceMonthly: p.price_monthly,
      isActive: Boolean(p.is_active),
      sortOrder: p.sort_order,
    }));
  }),

  createPlan: publicProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      maxEventsPerMonth: z.number().min(1),
      priceMonthly: z.number().min(0),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      ctx.db.prepare(`
        INSERT INTO subscription_plans (id, name, description, max_events_per_month, price_monthly, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        planId,
        input.name,
        input.description || null,
        input.maxEventsPerMonth,
        input.priceMonthly,
        input.sortOrder ?? 0
      );

      return { id: planId, success: true };
    }),

  updatePlan: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      maxEventsPerMonth: z.number().min(1).optional(),
      priceMonthly: z.number().min(0).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...updates } = input;
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
      if (updates.maxEventsPerMonth !== undefined) { fields.push('max_events_per_month = ?'); values.push(updates.maxEventsPerMonth); }
      if (updates.priceMonthly !== undefined) { fields.push('price_monthly = ?'); values.push(updates.priceMonthly); }
      if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
      if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }

      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        ctx.db.prepare(`UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      return { success: true };
    }),

  deletePlan: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const hasSubscriptions = ctx.db.prepare('SELECT COUNT(*) as count FROM promoter_subscriptions WHERE plan_id = ?').get(input.id) as any;
      if (hasSubscriptions.count > 0) {
        throw new Error('No se puede eliminar un plan con suscripciones activas');
      }
      ctx.db.prepare('DELETE FROM subscription_plans WHERE id = ?').run(input.id);
      return { success: true };
    }),

  getPromoterSubscription: publicProcedure
    .input(z.object({ promoterId: z.string() }))
    .query(({ ctx, input }) => {
      const subscription = ctx.db.prepare(`
        SELECT ps.*, sp.name as plan_name, sp.max_events_per_month, sp.price_monthly
        FROM promoter_subscriptions ps
        JOIN subscription_plans sp ON ps.plan_id = sp.id
        WHERE ps.promoter_id = ? AND ps.status = 'active'
        ORDER BY ps.created_at DESC
        LIMIT 1
      `).get(input.promoterId) as any;

      if (!subscription) return null;

      const periodStart = new Date(subscription.current_period_start);
      const periodEnd = new Date(subscription.current_period_end);

      const eventsThisMonth = ctx.db.prepare(`
        SELECT COUNT(*) as count FROM events 
        WHERE promoter_id = ? 
        AND created_at >= ? 
        AND created_at < ?
      `).get(input.promoterId, periodStart.toISOString(), periodEnd.toISOString()) as any;

      return {
        id: subscription.id,
        promoterId: subscription.promoter_id,
        planId: subscription.plan_id,
        planName: subscription.plan_name,
        maxEventsPerMonth: subscription.max_events_per_month,
        priceMonthly: subscription.price_monthly,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        eventsUsedThisMonth: eventsThisMonth.count,
        stripeSubscriptionId: subscription.stripe_subscription_id,
      };
    }),

  createSubscription: publicProcedure
    .input(z.object({
      promoterId: z.string(),
      planId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = ctx.db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(input.planId) as any;
      if (!plan) throw new Error('Plan no encontrado');

      const promoter = ctx.db.prepare('SELECT * FROM promoters WHERE id = ?').get(input.promoterId) as any;
      if (!promoter) throw new Error('Promotor no encontrado');

      const existingActive = ctx.db.prepare(`
        SELECT id FROM promoter_subscriptions 
        WHERE promoter_id = ? AND status = 'active'
      `).get(input.promoterId) as any;

      if (existingActive) {
        ctx.db.prepare(`
          UPDATE promoter_subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(existingActive.id);
      }

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      ctx.db.prepare(`
        INSERT INTO promoter_subscriptions (
          id, promoter_id, plan_id, status, current_period_start, current_period_end
        ) VALUES (?, ?, ?, 'active', ?, ?)
      `).run(
        subscriptionId,
        input.promoterId,
        input.planId,
        now.toISOString(),
        periodEnd.toISOString()
      );

      return { id: subscriptionId, success: true };
    }),

  createSubscriptionPayment: publicProcedure
    .input(z.object({
      promoterId: z.string(),
      planId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = ctx.db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(input.planId) as any;
      if (!plan) throw new Error('Plan no encontrado');

      const promoter = ctx.db.prepare('SELECT * FROM promoters WHERE id = ?').get(input.promoterId) as any;
      if (!promoter) throw new Error('Promotor no encontrado');

      try {
        const amountInCents = Math.round(plan.price_monthly * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'eur',
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            type: 'subscription',
            promoterId: input.promoterId,
            planId: input.planId,
            planName: plan.name,
          },
        });

        return {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: plan.price_monthly,
        };
      } catch (error: any) {
        console.error('Stripe subscription payment error:', error);
        throw new Error(`Error al crear el pago: ${error.message}`);
      }
    }),

  confirmSubscriptionPayment: publicProcedure
    .input(z.object({
      paymentIntentId: z.string(),
      promoterId: z.string(),
      planId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          throw new Error('El pago no se ha completado correctamente');
        }

        const plan = ctx.db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(input.planId) as any;
        if (!plan) throw new Error('Plan no encontrado');

        const existingActive = ctx.db.prepare(`
          SELECT id FROM promoter_subscriptions 
          WHERE promoter_id = ? AND status = 'active'
        `).get(input.promoterId) as any;

        if (existingActive) {
          ctx.db.prepare(`
            UPDATE promoter_subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(existingActive.id);
        }

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        ctx.db.prepare(`
          INSERT INTO promoter_subscriptions (
            id, promoter_id, plan_id, status, current_period_start, current_period_end
          ) VALUES (?, ?, ?, 'active', ?, ?)
        `).run(
          subscriptionId,
          input.promoterId,
          input.planId,
          now.toISOString(),
          periodEnd.toISOString()
        );

        return { 
          success: true, 
          subscriptionId,
          planName: plan.name,
        };
      } catch (error: any) {
        console.error('Confirm subscription payment error:', error);
        throw new Error(error.message || 'Error al confirmar el pago');
      }
    }),

  cancelSubscription: publicProcedure
    .input(z.object({ promoterId: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.prepare(`
        UPDATE promoter_subscriptions 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE promoter_id = ? AND status = 'active'
      `).run(input.promoterId);

      return { success: true };
    }),

  checkEventLimit: publicProcedure
    .input(z.object({ promoterId: z.string() }))
    .query(({ ctx, input }) => {
      const subscription = ctx.db.prepare(`
        SELECT ps.*, sp.max_events_per_month
        FROM promoter_subscriptions ps
        JOIN subscription_plans sp ON ps.plan_id = sp.id
        WHERE ps.promoter_id = ? AND ps.status = 'active'
        ORDER BY ps.created_at DESC
        LIMIT 1
      `).get(input.promoterId) as any;

      if (!subscription) {
        return {
          hasSubscription: false,
          canCreateEvent: false,
          eventsUsed: 0,
          eventsLimit: 0,
          message: 'Necesitas una suscripción activa para crear eventos',
        };
      }

      const periodStart = new Date(subscription.current_period_start);
      const periodEnd = new Date(subscription.current_period_end);

      const eventsThisMonth = ctx.db.prepare(`
        SELECT COUNT(*) as count FROM events 
        WHERE promoter_id = ? 
        AND created_at >= ? 
        AND created_at < ?
      `).get(input.promoterId, periodStart.toISOString(), periodEnd.toISOString()) as any;

      const canCreate = eventsThisMonth.count < subscription.max_events_per_month;

      return {
        hasSubscription: true,
        canCreateEvent: canCreate,
        eventsUsed: eventsThisMonth.count,
        eventsLimit: subscription.max_events_per_month,
        message: canCreate 
          ? `Puedes crear ${subscription.max_events_per_month - eventsThisMonth.count} eventos más este mes`
          : 'Has alcanzado el límite de eventos de tu plan',
      };
    }),

  getSubscriptionStats: publicProcedure.query(({ ctx }) => {
    const stats = ctx.db.prepare(`
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
        COALESCE(SUM(CASE WHEN status = 'active' THEN sp.price_monthly ELSE 0 END), 0) as monthly_revenue
      FROM promoter_subscriptions ps
      JOIN subscription_plans sp ON ps.plan_id = sp.id
    `).get() as any;

    const planStats = ctx.db.prepare(`
      SELECT 
        sp.id,
        sp.name,
        sp.price_monthly,
        COUNT(ps.id) as subscribers
      FROM subscription_plans sp
      LEFT JOIN promoter_subscriptions ps ON sp.id = ps.plan_id AND ps.status = 'active'
      WHERE sp.is_active = 1
      GROUP BY sp.id
      ORDER BY sp.sort_order
    `).all() as any[];

    return {
      totalSubscriptions: stats.total_subscriptions,
      activeSubscriptions: stats.active_subscriptions,
      monthlyRevenue: stats.monthly_revenue,
      planStats: planStats.map(p => ({
        id: p.id,
        name: p.name,
        priceMonthly: p.price_monthly,
        subscribers: p.subscribers,
      })),
    };
  }),
});
