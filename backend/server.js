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
    insertSetting.run('platform_commission', '5.0');
    insertSetting.run('currency', 'EUR');
    insertSetting.run('stripe_enabled', 'false');
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
    ctx.db.prepare('DELETE FROM events WHERE id = ?').run(input.id);
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
        (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.promoter_id = p.id) as total_earnings
      FROM promoters p ORDER BY p.created_at DESC
    `).all();
    return promoters.map(p => ({
      id: p.id, name: p.name, email: p.email, phone: p.phone,
      companyName: p.company_name, taxId: p.tax_id,
      stripeAccountId: p.stripe_account_id, stripeAccountStatus: p.stripe_account_status,
      commissionPercentage: p.commission_percentage, isActive: Boolean(p.is_active),
      createdAt: p.created_at, eventCount: p.event_count, totalEarnings: p.total_earnings,
    }));
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

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    const hasEvents = ctx.db.prepare('SELECT COUNT(*) as count FROM events WHERE promoter_id = ?').get(input.id);
    if (hasEvents.count > 0) throw new Error('No se puede eliminar un promotor con eventos asociados');
    ctx.db.prepare('DELETE FROM promoters WHERE id = ?').run(input.id);
    return { success: true };
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

const appRouter = createTRPCRouter({
  events: eventsRouter,
  tickets: ticketsRouter,
  sellers: sellersRouter,
  promoters: promotersRouter,
  stats: statsRouter,
  settings: settingsRouter,
});

const app = new Hono();
app.use('*', cors());
app.use('/trpc/*', trpcServer({ endpoint: '/trpc', router: appRouter, createContext }));
app.get('/', (c) => c.json({ status: 'ok', message: 'TicketZone API', version: '1.0.0' }));
app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

const port = parseInt(process.env.PORT || '3001', 10);

console.log('╔═══════════════════════════════════════════╗');
console.log('║     TicketZone Backend Server             ║');
console.log('╚═══════════════════════════════════════════╝');

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`✓ Servidor en http://localhost:${info.port}`);
  console.log(`✓ API tRPC en http://localhost:${info.port}/trpc`);
  console.log(`✓ Health check en http://localhost:${info.port}/health`);
});
