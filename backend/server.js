import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import Database from 'better-sqlite3';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ticketzone.db');

let db = null;

function getDatabase() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promoters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      company_name TEXT,
      tax_id TEXT,
      stripe_account_id TEXT,
      stripe_account_status TEXT DEFAULT 'pending',
      commission_percentage REAL DEFAULT 5.0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      promoter_id TEXT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      venue TEXT NOT NULL,
      location TEXT NOT NULL,
      image TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promoter_id) REFERENCES promoters(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_tiers (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      sold INTEGER DEFAULT 0,
      description TEXT,
      includes_bus INTEGER DEFAULT 0,
      is_vip INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sellers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      code TEXT UNIQUE NOT NULL,
      total_sales INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seller_commissions (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      min_sales INTEGER NOT NULL,
      max_sales INTEGER,
      percentage REAL NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      tier_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT NOT NULL,
      buyer_phone TEXT,
      qr_code TEXT UNIQUE NOT NULL,
      purchase_date TEXT DEFAULT CURRENT_TIMESTAMP,
      seller_id TEXT,
      seller_code TEXT,
      is_used INTEGER DEFAULT 0,
      used_at TEXT,
      payment_method TEXT NOT NULL,
      payment_intent_id TEXT,
      price REAL NOT NULL,
      platform_fee REAL DEFAULT 0,
      promoter_amount REAL DEFAULT 0,
      seller_commission REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id),
      FOREIGN KEY (seller_id) REFERENCES sellers(id)
    );

    CREATE TABLE IF NOT EXISTS promoter_payouts (
      id TEXT PRIMARY KEY,
      promoter_id TEXT NOT NULL,
      amount REAL NOT NULL,
      stripe_transfer_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (promoter_id) REFERENCES promoters(id)
    );

    CREATE TABLE IF NOT EXISTS seller_payouts (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (seller_id) REFERENCES sellers(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invitation_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      max_uses INTEGER DEFAULT 1,
      current_uses INTEGER DEFAULT 0,
      expires_at TEXT,
      created_by TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      max_events INTEGER NOT NULL,
      description TEXT,
      features TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promoter_subscriptions (
      id TEXT PRIMARY KEY,
      promoter_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      current_period_start TEXT,
      current_period_end TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promoter_id) REFERENCES promoters(id),
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
    CREATE INDEX IF NOT EXISTS idx_tickets_seller ON tickets(seller_id);
    CREATE INDEX IF NOT EXISTS idx_events_promoter ON events(promoter_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event ON ticket_tiers(event_id);
  `);

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('platform_name', 'TicketZone');
    insertSetting.run('platform_commission', '0');
    insertSetting.run('currency', 'EUR');
    insertSetting.run('stripe_enabled', 'false');
  }

  const plansCount = db.prepare('SELECT COUNT(*) as count FROM subscription_plans').get();
  if (plansCount.count === 0) {
    const insertPlan = db.prepare('INSERT INTO subscription_plans (id, name, price, max_events, description, features, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)');
    insertPlan.run('plan_basic', 'Básico', 29.99, 5, 'Ideal para empezar', JSON.stringify(['Hasta 5 eventos/mes', 'Soporte por email']));
    insertPlan.run('plan_pro', 'Profesional', 59.99, 15, 'Para promotores activos', JSON.stringify(['Hasta 15 eventos/mes', 'Soporte prioritario', 'Estadísticas avanzadas']));
    insertPlan.run('plan_enterprise', 'Empresarial', 99.99, 999, 'Sin límites', JSON.stringify(['Eventos ilimitados', 'Soporte 24/7', 'API access', 'Personalización']));
  }

  const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
  if (adminCount.count === 0) {
    const crypto = require('crypto');
    const adminId = 'user_admin_' + Date.now();
    const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)')
      .run(adminId, 'admin@ticketzone.com', passwordHash, 'Administrador', 'admin');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║  ADMIN CREADO:                            ║');
    console.log('║  Email: admin@ticketzone.com              ║');
    console.log('║  Password: admin123                       ║');
    console.log('╚═══════════════════════════════════════════╝');
  }

  console.log('✓ Base de datos inicializada correctamente');
}

const createContext = async (opts) => {
  return { req: opts.req, db: getDatabase() };
};

const t = initTRPC.context().create({ transformer: superjson });
const publicProcedure = t.procedure;
const createTRPCRouter = t.router;

const eventsRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    const events = ctx.db.prepare(`
      SELECT e.*, p.name as promoter_name, p.company_name as promoter_company
      FROM events e LEFT JOIN promoters p ON e.promoter_id = p.id
      ORDER BY e.date DESC
    `).all();

    return events.map(event => {
      const tiers = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?').all(event.id);
      return {
        id: event.id, name: event.name, date: event.date, time: event.time,
        venue: event.venue, location: event.location, image: event.image,
        description: event.description, isActive: Boolean(event.is_active),
        promoterId: event.promoter_id, promoterName: event.promoter_name,
        promoterCompany: event.promoter_company, createdAt: event.created_at,
        ticketTiers: tiers.map(t => ({
          id: t.id, name: t.name, price: t.price, quantity: t.quantity,
          sold: t.sold, description: t.description,
          includesBus: Boolean(t.includes_bus), isVip: Boolean(t.is_vip),
        })),
      };
    });
  }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    const event = ctx.db.prepare(`
      SELECT e.*, p.name as promoter_name FROM events e
      LEFT JOIN promoters p ON e.promoter_id = p.id WHERE e.id = ?
    `).get(input.id);
    if (!event) return null;
    const tiers = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?').all(event.id);
    return {
      id: event.id, name: event.name, date: event.date, time: event.time,
      venue: event.venue, location: event.location, image: event.image,
      description: event.description, isActive: Boolean(event.is_active),
      createdAt: event.created_at,
      ticketTiers: tiers.map(t => ({
        id: t.id, name: t.name, price: t.price, quantity: t.quantity,
        sold: t.sold, description: t.description,
        includesBus: Boolean(t.includes_bus), isVip: Boolean(t.is_vip),
      })),
    };
  }),

  create: publicProcedure.input(z.object({
    name: z.string(), date: z.string(), time: z.string(),
    venue: z.string(), location: z.string(), image: z.string().optional(),
    description: z.string().optional(), promoterId: z.string().optional(),
    ticketTiers: z.array(z.object({
      name: z.string(), price: z.number(), quantity: z.number(),
      description: z.string().optional(), includesBus: z.boolean().optional(),
      isVip: z.boolean().optional(),
    })),
  })).mutation(({ ctx, input }) => {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ctx.db.prepare(`
      INSERT INTO events (id, promoter_id, name, date, time, venue, location, image, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, input.promoterId || null, input.name, input.date, input.time,
           input.venue, input.location, input.image || null, input.description || null);

    const insertTier = ctx.db.prepare(`
      INSERT INTO ticket_tiers (id, event_id, name, price, quantity, description, includes_bus, is_vip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tier of input.ticketTiers) {
      const tierId = `tier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      insertTier.run(tierId, eventId, tier.name, tier.price, tier.quantity,
                     tier.description || null, tier.includesBus ? 1 : 0, tier.isVip ? 1 : 0);
    }
    return { id: eventId, success: true };
  }),

  update: publicProcedure.input(z.object({
    id: z.string(), name: z.string().optional(), date: z.string().optional(),
    time: z.string().optional(), venue: z.string().optional(),
    location: z.string().optional(), image: z.string().optional(),
    description: z.string().optional(), isActive: z.boolean().optional(),
  })).mutation(({ ctx, input }) => {
    const { id, ...updates } = input;
    const fields = []; const values = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
    if (updates.time !== undefined) { fields.push('time = ?'); values.push(updates.time); }
    if (updates.venue !== undefined) { fields.push('venue = ?'); values.push(updates.venue); }
    if (updates.location !== undefined) { fields.push('location = ?'); values.push(updates.location); }
    if (updates.image !== undefined) { fields.push('image = ?'); values.push(updates.image); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP'); values.push(id);
      ctx.db.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return { success: true };
  }),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.ctx.db.prepare('DELETE FROM events WHERE id = ?').run(input.id);
    return { success: true };
  }),
});

const ticketsRouter = createTRPCRouter({
  list: publicProcedure.input(z.object({ eventId: z.string().optional() }).optional()).query(({ ctx, input }) => {
    let query = `SELECT t.*, e.name as event_name, tt.name as tier_name, s.name as seller_name
      FROM tickets t JOIN events e ON t.event_id = e.id
      JOIN ticket_tiers tt ON t.tier_id = tt.id LEFT JOIN sellers s ON t.seller_id = s.id`;
    const params = [];
    if (input?.eventId) { query += ' WHERE t.event_id = ?'; params.push(input.eventId); }
    query += ' ORDER BY t.purchase_date DESC';
    const tickets = ctx.db.prepare(query).all(...params);
    return tickets.map(t => ({
      id: t.id, eventId: t.event_id, eventName: t.event_name, tierId: t.tier_id,
      tierName: t.tier_name, buyerName: t.buyer_name, buyerEmail: t.buyer_email,
      buyerPhone: t.buyer_phone, qrCode: t.qr_code, purchaseDate: t.purchase_date,
      sellerId: t.seller_id, sellerName: t.seller_name, sellerCode: t.seller_code,
      isUsed: Boolean(t.is_used), usedAt: t.used_at, paymentMethod: t.payment_method,
      price: t.price, platformFee: t.platform_fee, promoterAmount: t.promoter_amount,
    }));
  }),

  create: publicProcedure.input(z.object({
    eventId: z.string(), tierId: z.string(), buyerName: z.string(),
    buyerEmail: z.string(), buyerPhone: z.string().optional(),
    sellerCode: z.string().optional(),
    paymentMethod: z.enum(['card', 'googlepay', 'applepay', 'cash']),
  })).mutation(({ ctx, input }) => {
    const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId);
    if (!tier) throw new Error('Tipo de entrada no encontrado');
    if (tier.sold >= tier.quantity) throw new Error('Entradas agotadas');

    let seller = null; let sellerCommission = 0;
    if (input.sellerCode) {
      seller = ctx.db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(input.sellerCode.toUpperCase());
      if (seller) {
        const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id);
        for (const comm of commissions) {
          if (seller.total_sales >= comm.min_sales && (comm.max_sales === null || seller.total_sales < comm.max_sales)) {
            sellerCommission = tier.price * (comm.percentage / 100);
            break;
          }
        }
      }
    }

    const platformCommission = ctx.db.prepare("SELECT value FROM settings WHERE key = 'platform_commission'").get();
    const platformFee = tier.price * ((parseFloat(platformCommission?.value || '5') / 100));
    const promoterAmount = tier.price - platformFee - sellerCommission;

    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const qrCode = `${input.eventId}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    ctx.db.prepare(`INSERT INTO tickets (id, event_id, tier_id, buyer_name, buyer_email, buyer_phone,
      qr_code, seller_id, seller_code, payment_method, price, platform_fee, promoter_amount, seller_commission)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ticketId, input.eventId, input.tierId, input.buyerName, input.buyerEmail,
      input.buyerPhone || null, qrCode, seller?.id || null,
      input.sellerCode?.toUpperCase() || null, input.paymentMethod,
      tier.price, platformFee, promoterAmount, sellerCommission
    );

    ctx.db.prepare('UPDATE ticket_tiers SET sold = sold + 1 WHERE id = ?').run(input.tierId);

    if (seller) {
      ctx.db.prepare('UPDATE sellers SET total_sales = total_sales + 1, total_revenue = total_revenue + ? WHERE id = ?')
        .run(tier.price, seller.id);
    }

    return { id: ticketId, qrCode, price: tier.price, success: true };
  }),

  validate: publicProcedure.input(z.object({ qrCode: z.string() })).mutation(({ ctx, input }) => {
    const ticket = ctx.db.prepare(`SELECT t.*, e.name as event_name, tt.name as tier_name
      FROM tickets t JOIN events e ON t.event_id = e.id
      JOIN ticket_tiers tt ON t.tier_id = tt.id WHERE t.qr_code = ?`).get(input.qrCode);

    if (!ticket) return { success: false, message: 'Entrada no encontrada' };
    if (ticket.is_used) {
      return {
        success: false,
        message: `Entrada ya usada el ${new Date(ticket.used_at).toLocaleString('es-ES')}`,
        ticket: { id: ticket.id, eventName: ticket.event_name, tierName: ticket.tier_name,
                  buyerName: ticket.buyer_name, isUsed: true, usedAt: ticket.used_at },
      };
    }

    ctx.db.prepare('UPDATE tickets SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticket.id);
    return {
      success: true, message: 'Entrada válida ✓',
      ticket: { id: ticket.id, eventName: ticket.event_name, tierName: ticket.tier_name,
                buyerName: ticket.buyer_name, isUsed: true, usedAt: new Date().toISOString() },
    };
  }),
});

const sellersRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    const sellers = ctx.db.prepare('SELECT * FROM sellers ORDER BY created_at DESC').all();
    return sellers.map(seller => {
      const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id);
      return {
        id: seller.id, name: seller.name, email: seller.email, phone: seller.phone,
        code: seller.code, totalSales: seller.total_sales, totalRevenue: seller.total_revenue,
        isActive: Boolean(seller.is_active), createdAt: seller.created_at,
        commissionTiers: commissions.map(c => ({
          minSales: c.min_sales, maxSales: c.max_sales, percentage: c.percentage,
        })),
      };
    });
  }),

  getByCode: publicProcedure.input(z.object({ code: z.string() })).query(({ ctx, input }) => {
    const seller = ctx.db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(input.code.toUpperCase());
    if (!seller) return null;
    return { id: seller.id, name: seller.name, code: seller.code };
  }),

  create: publicProcedure.input(z.object({
    name: z.string(), email: z.string().email(), phone: z.string().optional(), code: z.string(),
  })).mutation(({ ctx, input }) => {
    const existing = ctx.db.prepare('SELECT id FROM sellers WHERE code = ? OR email = ?').get(input.code.toUpperCase(), input.email);
    if (existing) throw new Error('Ya existe un vendedor con ese código o email');

    const sellerId = `sel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ctx.db.prepare('INSERT INTO sellers (id, name, email, phone, code) VALUES (?, ?, ?, ?, ?)')
      .run(sellerId, input.name, input.email, input.phone || null, input.code.toUpperCase());

    const defaultTiers = [
      { minSales: 0, maxSales: 10, percentage: 5 },
      { minSales: 10, maxSales: 50, percentage: 7 },
      { minSales: 50, maxSales: null, percentage: 10 },
    ];
    const insertComm = ctx.db.prepare('INSERT INTO seller_commissions (id, seller_id, min_sales, max_sales, percentage) VALUES (?, ?, ?, ?, ?)');
    for (const tier of defaultTiers) {
      insertComm.run(`comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, sellerId, tier.minSales, tier.maxSales, tier.percentage);
    }
    return { id: sellerId, code: input.code.toUpperCase(), success: true };
  }),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.db.prepare('DELETE FROM sellers WHERE id = ?').run(input.id);
    return { success: true };
  }),
});

const promotersRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    const promoters = ctx.db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM events WHERE promoter_id = p.id) as event_count,
        (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.promoter_id = p.id) as total_earnings,
        (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id 
          WHERE e.promoter_id = p.id AND t.purchase_date > COALESCE(
            (SELECT MAX(completed_at) FROM promoter_payouts WHERE promoter_id = p.id AND status = 'completed'), '1970-01-01'
          )) as pending_payout
      FROM promoters p ORDER BY p.created_at DESC
    `).all();
    return promoters.map(p => ({
      id: p.id, name: p.name, email: p.email, phone: p.phone,
      companyName: p.company_name, taxId: p.tax_id,
      stripeAccountId: p.stripe_account_id, stripeAccountStatus: p.stripe_account_status,
      commissionPercentage: p.commission_percentage, isActive: Boolean(p.is_active),
      createdAt: p.created_at, eventCount: p.event_count, totalEarnings: p.total_earnings,
      pendingPayout: p.pending_payout || 0,
    }));
  }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    const promoter = ctx.db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM events WHERE promoter_id = p.id) as event_count,
        (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.promoter_id = p.id) as total_earnings
      FROM promoters p WHERE p.id = ?
    `).get(input.id);
    if (!promoter) return null;

    const events = ctx.db.prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM tickets WHERE event_id = e.id) as tickets_sold,
        (SELECT COALESCE(SUM(price), 0) FROM tickets WHERE event_id = e.id) as revenue
      FROM events e WHERE e.promoter_id = ? ORDER BY e.date DESC
    `).all(input.id);

    const payouts = ctx.db.prepare('SELECT * FROM promoter_payouts WHERE promoter_id = ? ORDER BY created_at DESC LIMIT 20').all(input.id);

    return {
      id: promoter.id, name: promoter.name, email: promoter.email, phone: promoter.phone,
      companyName: promoter.company_name, taxId: promoter.tax_id,
      stripeAccountId: promoter.stripe_account_id, stripeAccountStatus: promoter.stripe_account_status,
      commissionPercentage: promoter.commission_percentage, isActive: Boolean(promoter.is_active),
      createdAt: promoter.created_at, eventCount: promoter.event_count, totalEarnings: promoter.total_earnings,
      events: events.map(e => ({
        id: e.id, name: e.name, date: e.date, venue: e.venue,
        ticketsSold: e.tickets_sold, revenue: e.revenue, isActive: Boolean(e.is_active),
      })),
      payouts: payouts.map(p => ({
        id: p.id, amount: p.amount, status: p.status,
        stripeTransferId: p.stripe_transfer_id, createdAt: p.created_at, completedAt: p.completed_at,
      })),
    };
  }),

  create: publicProcedure.input(z.object({
    name: z.string(), email: z.string().email(), phone: z.string().optional(),
    companyName: z.string().optional(), taxId: z.string().optional(),
    commissionPercentage: z.number().min(0).max(100).optional(),
  })).mutation(({ ctx, input }) => {
    const existing = ctx.db.prepare('SELECT id FROM promoters WHERE email = ?').get(input.email);
    if (existing) throw new Error('Ya existe un promotor con ese email');

    const promoterId = `prm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ctx.db.prepare(`INSERT INTO promoters (id, name, email, phone, company_name, tax_id, commission_percentage)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      promoterId, input.name, input.email, input.phone || null,
      input.companyName || null, input.taxId || null, input.commissionPercentage ?? 5.0
    );
    return { id: promoterId, success: true };
  }),

  update: publicProcedure.input(z.object({
    id: z.string(), name: z.string().optional(), email: z.string().email().optional(),
    phone: z.string().optional(), companyName: z.string().optional(), taxId: z.string().optional(),
    commissionPercentage: z.number().min(0).max(100).optional(), isActive: z.boolean().optional(),
  })).mutation(({ ctx, input }) => {
    const { id, ...updates } = input;
    const fields = []; const values = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.companyName !== undefined) { fields.push('company_name = ?'); values.push(updates.companyName); }
    if (updates.taxId !== undefined) { fields.push('tax_id = ?'); values.push(updates.taxId); }
    if (updates.commissionPercentage !== undefined) { fields.push('commission_percentage = ?'); values.push(updates.commissionPercentage); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP'); values.push(id);
      ctx.db.prepare(`UPDATE promoters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return { success: true };
  }),

  connectStripe: publicProcedure.input(z.object({
    id: z.string(), stripeAccountId: z.string(),
  })).mutation(({ ctx, input }) => {
    ctx.db.prepare(`UPDATE promoters SET stripe_account_id = ?, stripe_account_status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(input.stripeAccountId, input.id);
    return { success: true };
  }),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    const hasEvents = ctx.db.prepare('SELECT COUNT(*) as count FROM events WHERE promoter_id = ?').get(input.id);
    if (hasEvents.count > 0) throw new Error('No se puede eliminar un promotor con eventos asociados');
    ctx.db.prepare('DELETE FROM promoters WHERE id = ?').run(input.id);
    return { success: true };
  }),
});

const paymentsRouter = createTRPCRouter({
  createPaymentIntent: publicProcedure.input(z.object({
    eventId: z.string(),
    tierId: z.string(),
    quantity: z.number().min(1),
    buyerName: z.string(),
    buyerEmail: z.string(),
    buyerPhone: z.string().optional(),
    sellerCode: z.string().optional(),
  })).mutation(({ ctx, input }) => {
    const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId);
    if (!tier) throw new Error('Tipo de entrada no encontrado');
    if (tier.sold + input.quantity > tier.quantity) throw new Error('No hay suficientes entradas disponibles');

    const event = ctx.db.prepare(`SELECT e.*, p.stripe_account_id, p.commission_percentage
      FROM events e LEFT JOIN promoters p ON e.promoter_id = p.id WHERE e.id = ?`).get(input.eventId);
    if (!event) throw new Error('Evento no encontrado');

    const totalAmount = tier.price * input.quantity;
    const platformCommission = event.commission_percentage || 5;
    const platformFee = totalAmount * (platformCommission / 100);
    const promoterAmount = totalAmount - platformFee;

    const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      paymentIntentId,
      clientSecret: `${paymentIntentId}_secret_${Math.random().toString(36).substr(2, 16)}`,
      amount: Math.round(totalAmount * 100),
      currency: 'eur',
      platformFee: Math.round(platformFee * 100),
      promoterAmount: Math.round(promoterAmount * 100),
      stripeAccountId: event.stripe_account_id,
      metadata: {
        eventId: input.eventId,
        tierId: input.tierId,
        quantity: input.quantity,
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        sellerCode: input.sellerCode || null,
      },
    };
  }),

  confirmPayment: publicProcedure.input(z.object({
    paymentIntentId: z.string(),
    eventId: z.string(),
    tierId: z.string(),
    quantity: z.number().min(1),
    buyerName: z.string(),
    buyerEmail: z.string(),
    buyerPhone: z.string().optional(),
    sellerCode: z.string().optional(),
  })).mutation(({ ctx, input }) => {
    const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId);
    if (!tier) throw new Error('Tipo de entrada no encontrado');

    const tickets = [];
    let seller = null;
    let sellerCommission = 0;

    if (input.sellerCode) {
      seller = ctx.db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(input.sellerCode.toUpperCase());
      if (seller) {
        const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id);
        for (const comm of commissions) {
          if (seller.total_sales >= comm.min_sales && (comm.max_sales === null || seller.total_sales < comm.max_sales)) {
            sellerCommission = tier.price * (comm.percentage / 100);
            break;
          }
        }
      }
    }

    const platformCommission = ctx.db.prepare("SELECT value FROM settings WHERE key = 'platform_commission'").get();
    const platformFee = tier.price * ((parseFloat(platformCommission?.value || '5') / 100));
    const promoterAmount = tier.price - platformFee - sellerCommission;

    for (let i = 0; i < input.quantity; i++) {
      const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const qrCode = `${input.eventId}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      ctx.db.prepare(`INSERT INTO tickets (id, event_id, tier_id, buyer_name, buyer_email, buyer_phone,
        qr_code, seller_id, seller_code, payment_method, payment_intent_id, price, platform_fee, promoter_amount, seller_commission)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        ticketId, input.eventId, input.tierId, input.buyerName, input.buyerEmail,
        input.buyerPhone || null, qrCode, seller?.id || null,
        input.sellerCode?.toUpperCase() || null, 'card', input.paymentIntentId,
        tier.price, platformFee, promoterAmount, sellerCommission
      );

      tickets.push({ id: ticketId, qrCode, price: tier.price });
    }

    ctx.db.prepare('UPDATE ticket_tiers SET sold = sold + ? WHERE id = ?').run(input.quantity, input.tierId);

    if (seller) {
      ctx.db.prepare('UPDATE sellers SET total_sales = total_sales + ?, total_revenue = total_revenue + ? WHERE id = ?')
        .run(input.quantity, tier.price * input.quantity, seller.id);
    }

    return { success: true, tickets, total: tier.price * input.quantity };
  }),

  getPromoterPayouts: publicProcedure.input(z.object({ promoterId: z.string() })).query(({ ctx, input }) => {
    const payouts = ctx.db.prepare('SELECT * FROM promoter_payouts WHERE promoter_id = ? ORDER BY created_at DESC').all(input.promoterId);
    return payouts.map(p => ({
      id: p.id, amount: p.amount, status: p.status,
      stripeTransferId: p.stripe_transfer_id, createdAt: p.created_at, completedAt: p.completed_at,
    }));
  }),

  createPayout: publicProcedure.input(z.object({
    promoterId: z.string(), amount: z.number().min(1),
  })).mutation(({ ctx, input }) => {
    const promoter = ctx.db.prepare('SELECT * FROM promoters WHERE id = ?').get(input.promoterId);
    if (!promoter) throw new Error('Promotor no encontrado');
    if (!promoter.stripe_account_id || promoter.stripe_account_status !== 'active') {
      throw new Error('El promotor no tiene una cuenta de Stripe activa');
    }

    const payoutId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ctx.db.prepare(`INSERT INTO promoter_payouts (id, promoter_id, amount, status) VALUES (?, ?, ?, 'processing')`)
      .run(payoutId, input.promoterId, input.amount);

    return { id: payoutId, success: true };
  }),
});

const statsRouter = createTRPCRouter({
  dashboard: publicProcedure.query(({ ctx }) => {
    const today = new Date().toISOString().split('T')[0];
    const totalStats = ctx.db.prepare(`SELECT COUNT(*) as total_tickets,
      COALESCE(SUM(price), 0) as total_revenue, COALESCE(SUM(platform_fee), 0) as platform_earnings
      FROM tickets`).get();
    const todayStats = ctx.db.prepare(`SELECT COUNT(*) as today_tickets, COALESCE(SUM(price), 0) as today_revenue
      FROM tickets WHERE DATE(purchase_date) = ?`).get(today);
    const eventStats = ctx.db.prepare('SELECT COUNT(*) as total_events FROM events').get();
    const activeEvents = ctx.db.prepare('SELECT COUNT(*) as active_events FROM events WHERE is_active = 1').get();
    const sellerStats = ctx.db.prepare('SELECT COUNT(*) as total_sellers FROM sellers WHERE is_active = 1').get();
    const promoterStats = ctx.db.prepare('SELECT COUNT(*) as total_promoters FROM promoters WHERE is_active = 1').get();
    const recentTickets = ctx.db.prepare(`SELECT t.id, t.buyer_name, t.price, t.purchase_date, e.name as event_name
      FROM tickets t JOIN events e ON t.event_id = e.id ORDER BY t.purchase_date DESC LIMIT 10`).all();
    const topEvents = ctx.db.prepare(`SELECT e.id, e.name, e.date, COUNT(t.id) as tickets_sold, COALESCE(SUM(t.price), 0) as revenue
      FROM events e LEFT JOIN tickets t ON e.id = t.event_id GROUP BY e.id ORDER BY revenue DESC LIMIT 5`).all();

    return {
      totalRevenue: totalStats.total_revenue, totalTicketsSold: totalStats.total_tickets,
      platformEarnings: totalStats.platform_earnings, todayRevenue: todayStats.today_revenue,
      todayTickets: todayStats.today_tickets, totalEvents: eventStats.total_events,
      activeEvents: activeEvents.active_events, totalSellers: sellerStats.total_sellers,
      totalPromoters: promoterStats.total_promoters,
      recentTickets: recentTickets.map(t => ({
        id: t.id, buyerName: t.buyer_name, price: t.price, purchaseDate: t.purchase_date, eventName: t.event_name,
      })),
      topEvents: topEvents.map(e => ({ id: e.id, name: e.name, date: e.date, ticketsSold: e.tickets_sold, revenue: e.revenue })),
    };
  }),
});

const settingsRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    const settings = ctx.db.prepare('SELECT * FROM settings').all();
    const result = {};
    for (const s of settings) result[s.key] = s.value;
    return result;
  }),
  set: publicProcedure.input(z.object({ key: z.string(), value: z.string() })).mutation(({ ctx, input }) => {
    ctx.db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(input.key, input.value);
    return { success: true };
  }),
});

function generateInvitationCode() {
  return 'INV-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function hashPassword(password) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.db.prepare(`
        SELECT * FROM users WHERE email = ? AND is_active = 1
      `).get(input.email.toLowerCase());

      if (!user) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      if (!verifyPassword(input.password, user.password_hash)) {
        throw new Error('Contraseña incorrecta');
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.enum(['admin', 'seller']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase());
      
      if (existing) {
        throw new Error('Este email ya está registrado');
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = hashPassword(input.password);

      ctx.db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(userId, input.email.toLowerCase(), passwordHash, input.name, input.role || 'admin');

      return {
        success: true,
        user: {
          id: userId,
          email: input.email.toLowerCase(),
          name: input.name,
          role: input.role || 'admin',
        },
      };
    }),

  registerUser: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase());
      
      if (existing) {
        throw new Error('Este email ya está registrado');
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = hashPassword(input.password);

      ctx.db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, is_active)
        VALUES (?, ?, ?, ?, 'buyer', 1)
      `).run(userId, input.email.toLowerCase(), passwordHash, input.name);

      return {
        success: true,
        user: {
          id: userId,
          email: input.email.toLowerCase(),
          name: input.name,
          role: 'buyer',
        },
      };
    }),

  registerWithInvitation: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      phone: z.string().optional(),
      invitationCode: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const invitation = ctx.db.prepare(`
        SELECT * FROM invitation_codes 
        WHERE code = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (max_uses = 0 OR current_uses < max_uses)
      `).get(input.invitationCode.toUpperCase());

      if (!invitation) {
        throw new Error('Código de invitación inválido, expirado o agotado');
      }

      const existingUser = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase());
      if (existingUser) {
        throw new Error('Este email ya está registrado');
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const passwordHash = hashPassword(input.password);

      ctx.db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(userId, input.email.toLowerCase(), passwordHash, input.name, invitation.type);

      if (invitation.type === 'promoter') {
        const promoterId = `promoter_${Date.now()}`;
        ctx.db.prepare(`
          INSERT INTO promoters (id, name, email, phone, is_active)
          VALUES (?, ?, ?, ?, 1)
        `).run(promoterId, input.name, input.email.toLowerCase(), input.phone || null);
      } else if (invitation.type === 'seller') {
        const sellerId = `seller_${Date.now()}`;
        const sellerCode = 'RRPP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        ctx.db.prepare(`
          INSERT INTO sellers (id, name, email, phone, code, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(sellerId, input.name, input.email.toLowerCase(), input.phone || null, sellerCode);
      }

      ctx.db.prepare(`
        UPDATE invitation_codes SET current_uses = current_uses + 1 WHERE id = ?
      `).run(invitation.id);

      return {
        success: true,
        user: {
          id: userId,
          email: input.email.toLowerCase(),
          name: input.name,
          role: invitation.type,
        },
      };
    }),

  getUsers: publicProcedure.query(({ ctx }) => {
    const users = ctx.db.prepare(`
      SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at DESC
    `).all();

    return users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.is_active === 1,
      createdAt: u.created_at,
    }));
  }),

  updateUser: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      role: z.enum(['admin', 'seller', 'promoter', 'buyer']).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = [];
      const values = [];

      if (input.name !== undefined) {
        updates.push('name = ?');
        values.push(input.name);
      }
      if (input.role !== undefined) {
        updates.push('role = ?');
        values.push(input.role);
      }
      if (input.isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(input.isActive ? 1 : 0);
      }
      if (input.password !== undefined) {
        updates.push('password_hash = ?');
        values.push(hashPassword(input.password));
      }

      if (updates.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      values.push(input.id);
      ctx.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      return { success: true };
    }),

  deleteUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM users WHERE id = ?').run(input.id);
      return { success: true };
    }),

  getProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ ctx, input }) => {
      const user = ctx.db.prepare(`
        SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ?
      `).get(input.userId);

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
      };
    }),

  createInvitationCode: publicProcedure
    .input(z.object({
      type: z.enum(['promoter', 'seller']),
      maxUses: z.number().min(0).default(1),
      expiresInDays: z.number().min(0).optional(),
      createdBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = `inv_${Date.now()}`;
      const code = generateInvitationCode();
      const expiresAt = input.expiresInDays 
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      ctx.db.prepare(`
        INSERT INTO invitation_codes (id, code, type, max_uses, expires_at, created_by, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(id, code, input.type, input.maxUses, expiresAt, input.createdBy);

      return { success: true, code, id };
    }),

  getInvitationCodes: publicProcedure.query(({ ctx }) => {
    const codes = ctx.db.prepare(`
      SELECT ic.*, u.name as created_by_name 
      FROM invitation_codes ic
      LEFT JOIN users u ON ic.created_by = u.id
      ORDER BY ic.created_at DESC
    `).all();

    return codes.map(c => ({
      id: c.id,
      code: c.code,
      type: c.type,
      maxUses: c.max_uses,
      currentUses: c.current_uses,
      expiresAt: c.expires_at,
      createdBy: c.created_by_name || 'Sistema',
      isActive: c.is_active === 1,
      createdAt: c.created_at,
    }));
  }),

  deleteInvitationCode: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM invitation_codes WHERE id = ?').run(input.id);
      return { success: true };
    }),

  toggleInvitationCode: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      ctx.db.prepare('UPDATE invitation_codes SET is_active = ? WHERE id = ?').run(input.isActive ? 1 : 0, input.id);
      return { success: true };
    }),

  validateInvitationCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(({ ctx, input }) => {
      const invitation = ctx.db.prepare(`
        SELECT type FROM invitation_codes 
        WHERE code = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (max_uses = 0 OR current_uses < max_uses)
      `).get(input.code.toUpperCase());

      return {
        valid: !!invitation,
        type: invitation?.type || null,
      };
    }),

  updateProfile: publicProcedure
    .input(z.object({
      userId: z.string(),
      name: z.string().optional(),
      phone: z.string().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(input.userId);
      if (!user) throw new Error('Usuario no encontrado');

      if (input.newPassword) {
        if (!input.currentPassword) {
          throw new Error('Debes proporcionar la contraseña actual');
        }
        if (!verifyPassword(input.currentPassword, user.password_hash)) {
          throw new Error('Contraseña actual incorrecta');
        }
      }

      const updates = [];
      const values = [];

      if (input.name !== undefined) {
        updates.push('name = ?');
        values.push(input.name);
      }
      if (input.newPassword) {
        updates.push('password_hash = ?');
        values.push(hashPassword(input.newPassword));
      }

      if (updates.length > 0) {
        values.push(input.userId);
        ctx.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      return { success: true };
    }),
});

const subscriptionsRouter = createTRPCRouter({
  getPlans: publicProcedure.query(({ ctx }) => {
    const plans = ctx.db.prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY max_events ASC').all();
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      maxEvents: p.max_events,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
      isActive: p.is_active === 1,
    }));
  }),

  getAllPlans: publicProcedure.query(({ ctx }) => {
    const plans = ctx.db.prepare('SELECT * FROM subscription_plans ORDER BY max_events ASC').all();
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      maxEvents: p.max_events,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
      isActive: p.is_active === 1,
    }));
  }),

  createPlan: publicProcedure
    .input(z.object({
      name: z.string(),
      price: z.number().min(0),
      maxEvents: z.number().min(1),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const id = `plan_${Date.now()}`;
      ctx.db.prepare(`
        INSERT INTO subscription_plans (id, name, price, max_events, description, features, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(id, input.name, input.price, input.maxEvents, input.description || '', JSON.stringify(input.features || []));
      return { id, success: true };
    }),

  updatePlan: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      price: z.number().min(0).optional(),
      maxEvents: z.number().min(1).optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const updates = [];
      const values = [];

      if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
      if (input.price !== undefined) { updates.push('price = ?'); values.push(input.price); }
      if (input.maxEvents !== undefined) { updates.push('max_events = ?'); values.push(input.maxEvents); }
      if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
      if (input.features !== undefined) { updates.push('features = ?'); values.push(JSON.stringify(input.features)); }
      if (input.isActive !== undefined) { updates.push('is_active = ?'); values.push(input.isActive ? 1 : 0); }

      if (updates.length > 0) {
        values.push(input.id);
        ctx.db.prepare(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
      return { success: true };
    }),

  deletePlan: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.prepare('DELETE FROM subscription_plans WHERE id = ?').run(input.id);
      return { success: true };
    }),

  getPromoterSubscription: publicProcedure
    .input(z.object({ promoterId: z.string() }))
    .query(({ ctx, input }) => {
      const sub = ctx.db.prepare(`
        SELECT ps.*, sp.name as plan_name, sp.price as plan_price, sp.max_events
        FROM promoter_subscriptions ps
        JOIN subscription_plans sp ON ps.plan_id = sp.id
        WHERE ps.promoter_id = ? AND ps.status = 'active'
        ORDER BY ps.created_at DESC LIMIT 1
      `).get(input.promoterId);
      
      if (!sub) return null;
      
      const eventsThisMonth = ctx.db.prepare(`
        SELECT COUNT(*) as count FROM events 
        WHERE promoter_id = ? AND created_at >= date('now', 'start of month')
      `).get(input.promoterId);

      return {
        id: sub.id,
        planId: sub.plan_id,
        planName: sub.plan_name,
        planPrice: sub.plan_price,
        maxEvents: sub.max_events,
        status: sub.status,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        eventsUsed: eventsThisMonth?.count || 0,
      };
    }),

  subscribe: publicProcedure
    .input(z.object({
      promoterId: z.string(),
      planId: z.string(),
    }))
    .mutation(({ ctx, input }) => {
      const plan = ctx.db.prepare('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1').get(input.planId);
      if (!plan) throw new Error('Plan no encontrado');

      ctx.db.prepare(`UPDATE promoter_subscriptions SET status = 'cancelled' WHERE promoter_id = ? AND status = 'active'`).run(input.promoterId);

      const id = `sub_${Date.now()}`;
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      ctx.db.prepare(`
        INSERT INTO promoter_subscriptions (id, promoter_id, plan_id, status, current_period_start, current_period_end)
        VALUES (?, ?, ?, 'active', ?, ?)
      `).run(id, input.promoterId, input.planId, now.toISOString(), periodEnd.toISOString());

      return { id, success: true };
    }),

  cancelSubscription: publicProcedure
    .input(z.object({ promoterId: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.prepare(`UPDATE promoter_subscriptions SET status = 'cancelled' WHERE promoter_id = ? AND status = 'active'`).run(input.promoterId);
      return { success: true };
    }),

  canCreateEvent: publicProcedure
    .input(z.object({ promoterId: z.string() }))
    .query(({ ctx, input }) => {
      const sub = ctx.db.prepare(`
        SELECT ps.*, sp.max_events
        FROM promoter_subscriptions ps
        JOIN subscription_plans sp ON ps.plan_id = sp.id
        WHERE ps.promoter_id = ? AND ps.status = 'active'
      `).get(input.promoterId);

      if (!sub) return { canCreate: false, reason: 'No tienes una suscripción activa' };

      const eventsThisMonth = ctx.db.prepare(`
        SELECT COUNT(*) as count FROM events 
        WHERE promoter_id = ? AND created_at >= date('now', 'start of month')
      `).get(input.promoterId);

      if (eventsThisMonth.count >= sub.max_events) {
        return { canCreate: false, reason: `Has alcanzado el límite de ${sub.max_events} eventos este mes` };
      }

      return { canCreate: true, eventsRemaining: sub.max_events - eventsThisMonth.count };
    }),
});

const appRouter = createTRPCRouter({
  events: eventsRouter,
  tickets: ticketsRouter,
  sellers: sellersRouter,
  promoters: promotersRouter,
  payments: paymentsRouter,
  stats: statsRouter,
  settings: settingsRouter,
  auth: authRouter,
  subscriptions: subscriptionsRouter,
});

const app = new Hono();
app.use('*', cors());
app.use('/api/trpc/*', trpcServer({ endpoint: '/api/trpc', router: appRouter, createContext }));
app.get('/', (c) => c.json({ status: 'ok', message: 'TicketZone API', version: '1.0.0' }));
app.get('/api/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));
app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

const port = parseInt(process.env.PORT || '3001', 10);

console.log('╔═══════════════════════════════════════════╗');
console.log('║     TicketZone Backend Server             ║');
console.log('╚═══════════════════════════════════════════╝');

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`✓ Servidor en http://localhost:${info.port}`);
  console.log(`✓ API tRPC en http://localhost:${info.port}/api/trpc`);
  console.log(`✓ Health check en http://localhost:${info.port}/api/health`);
});
