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
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

if (!stripe) {
  console.warn('⚠️  STRIPE_SECRET_KEY no configurada - Los pagos no funcionarán');
} else {
  console.log('✓ Stripe inicializado correctamente');
}

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ticketzone.db');

let db = null;

function getDatabase() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log('[DB] Abriendo base de datos en:', DB_PATH);
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = FULL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    
    initializeDatabase(db);
    console.log('[DB] Base de datos lista');
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
      billing_model TEXT DEFAULT 'commission',
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
      buyer_birthdate TEXT,
      buyer_gender TEXT,
      buyer_city TEXT,
      buyer_country TEXT,
      buyer_latitude REAL,
      buyer_longitude REAL,
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
      email_verified INTEGER DEFAULT 0,
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

  // Migraciones: añadir columnas que faltan en bases de datos existentes
  try {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
    console.log('>>> Migración: columna email_verified añadida a users');
  } catch (_e) {
    // La columna ya existe, ignorar
  }

  // Migraciones para datos demográficos de compradores
  const demographicColumns = [
    { name: 'buyer_birthdate', type: 'TEXT' },
    { name: 'buyer_gender', type: 'TEXT' },
    { name: 'buyer_city', type: 'TEXT' },
    { name: 'buyer_country', type: 'TEXT' },
    { name: 'buyer_latitude', type: 'REAL' },
    { name: 'buyer_longitude', type: 'REAL' },
  ];
  for (const col of demographicColumns) {
    try {
      db.exec(`ALTER TABLE tickets ADD COLUMN ${col.name} ${col.type}`);
      console.log(`>>> Migración: columna ${col.name} añadida a tickets`);
    } catch (_e2) {
      // La columna ya existe
    }
  }

  // Migración: añadir billing_model a promoters
  try {
    db.exec(`ALTER TABLE promoters ADD COLUMN billing_model TEXT DEFAULT 'commission'`);
    console.log('>>> Migración: columna billing_model añadida a promoters');
  } catch (_e3) {
    // La columna ya existe
  }

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      user_data TEXT,
      expires_at TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
    CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(code);
  `);

  const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
  if (adminCount.count === 0) {
    const adminId = 'user_admin_' + Date.now();
    const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, is_active, email_verified) VALUES (?, ?, ?, ?, ?, 1, 1)')
      .run(adminId, 'devilworks2023@gmail.com', passwordHash, 'Administrador', 'admin');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║  NUEVO ADMIN CREADO:                      ║');
    console.log('║  Email: devilworks2023@gmail.com          ║');
    console.log('║  Password: admin123                       ║');
    console.log('╚═══════════════════════════════════════════╝');
  }

  // Asegurar que todos los admins existentes tengan email verificado
  db.prepare('UPDATE users SET email_verified = 1 WHERE role = ?').run('admin');

  // Siempre mostrar los admins existentes al iniciar
  const admins = db.prepare('SELECT email, name, is_active FROM users WHERE role = ?').all('admin');
  console.log('');
  console.log('='.repeat(60));
  console.log('='.repeat(60));
  console.log('   ESTADO DE LA BASE DE DATOS');
  console.log('='.repeat(60));
  console.log('');
  console.log('>>> ADMINISTRADORES:');
  if (admins.length === 0) {
    console.log('   (No hay administradores)');
  } else {
    admins.forEach(admin => {
      const status = admin.is_active ? 'ACTIVO' : 'INACTIVO';
      console.log(`   - Email: ${admin.email}`);
      console.log(`     Nombre: ${admin.name}`);
      console.log(`     Estado: ${status}`);
    });
  }
  console.log('');
  console.log('>>> CREDENCIALES POR DEFECTO:');
  console.log('   Email: devilworks2023@gmail.com');
  console.log('   Password: admin123');
  console.log('');
  
  // Mostrar todos los usuarios
  const allUsers = db.prepare('SELECT id, email, name, role, is_active, email_verified FROM users').all();
  console.log('>>> TODOS LOS USUARIOS EN LA BASE DE DATOS:');
  if (allUsers.length === 0) {
    console.log('   (No hay usuarios)');
  } else {
    console.log(`   Total: ${allUsers.length} usuarios`);
    allUsers.forEach((user, index) => {
      console.log(`   [${index + 1}] ${user.email}`);
      console.log(`       ID: ${user.id}`);
      console.log(`       Nombre: ${user.name}`);
      console.log(`       Rol: ${user.role}`);
      console.log(`       Activo: ${user.is_active ? 'SI' : 'NO'}`);
      console.log(`       Email verificado: ${user.email_verified ? 'SI' : 'NO'}`);
    });
  }
  console.log('');
  console.log('='.repeat(60));
  console.log('='.repeat(60));
  console.log('');

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
    console.log('[EVENTS] Eliminando evento:', input.id);
    
    try {
      // Verificar que el evento existe
      const event = ctx.db.prepare('SELECT * FROM events WHERE id = ?').get(input.id);
      if (!event) {
        throw new Error('Evento no encontrado');
      }
      
      // Contar entradas asociadas
      const ticketCount = ctx.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE event_id = ?').get(input.id);
      console.log('[EVENTS] Entradas a eliminar:', ticketCount?.count || 0);
      
      // Primero eliminar tickets relacionados
      const ticketsResult = ctx.db.prepare('DELETE FROM tickets WHERE event_id = ?').run(input.id);
      console.log('[EVENTS] Entradas eliminadas:', ticketsResult.changes);
      
      // Luego eliminar ticket_tiers relacionados
      const tiersResult = ctx.db.prepare('DELETE FROM ticket_tiers WHERE event_id = ?').run(input.id);
      console.log('[EVENTS] Tiers eliminados:', tiersResult.changes);
      
      // Finalmente eliminar el evento
      const eventResult = ctx.db.prepare('DELETE FROM events WHERE id = ?').run(input.id);
      console.log('[EVENTS] Evento eliminado:', eventResult.changes);
      
      if (eventResult.changes === 0) {
        throw new Error('No se pudo eliminar el evento');
      }
      
      console.log('[EVENTS] Evento eliminado exitosamente:', input.id);
      return { success: true };
    } catch (error) {
      console.error('[EVENTS] Error eliminando evento:', error);
      throw new Error(error.message || 'Error al eliminar el evento');
    }
  }),

  toggleActive: publicProcedure.input(z.object({ 
    id: z.string(), 
    isActive: z.boolean() 
  })).mutation(({ ctx, input }) => {
    ctx.db.prepare('UPDATE events SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(input.isActive ? 1 : 0, input.id);
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

  listAll: publicProcedure.query(({ ctx }) => {
    const tickets = ctx.db.prepare(`
      SELECT t.*, e.name as event_name, tt.name as tier_name, s.name as seller_name
      FROM tickets t 
      JOIN events e ON t.event_id = e.id
      JOIN ticket_tiers tt ON t.tier_id = tt.id 
      LEFT JOIN sellers s ON t.seller_id = s.id
      ORDER BY t.purchase_date DESC
      LIMIT 1000
    `).all();
    return tickets.map(t => ({
      id: t.id, eventId: t.event_id, eventName: t.event_name, tierId: t.tier_id,
      tierName: t.tier_name, buyerName: t.buyer_name, buyerEmail: t.buyer_email,
      buyerPhone: t.buyer_phone, qrCode: t.qr_code, purchaseDate: t.purchase_date,
      sellerId: t.seller_id, sellerName: t.seller_name, sellerCode: t.seller_code,
      isUsed: Boolean(t.is_used), usedAt: t.used_at, paymentMethod: t.payment_method,
      price: t.price, platformFee: t.platform_fee, promoterAmount: t.promoter_amount,
    }));
  }),

  getByEmail: publicProcedure.input(z.object({ email: z.string().email() })).query(({ ctx, input }) => {
    const tickets = ctx.db.prepare(`
      SELECT t.*, e.name as event_name, e.date as event_date, e.time as event_time, e.venue,
             tt.name as tier_name, s.name as seller_name
      FROM tickets t 
      JOIN events e ON t.event_id = e.id
      JOIN ticket_tiers tt ON t.tier_id = tt.id 
      LEFT JOIN sellers s ON t.seller_id = s.id
      WHERE LOWER(t.buyer_email) = LOWER(?)
      ORDER BY t.purchase_date DESC
    `).all(input.email);
    return tickets.map(t => ({
      id: t.id, eventId: t.event_id, eventName: t.event_name, 
      eventDate: t.event_date, eventTime: t.event_time, venue: t.venue,
      tierId: t.tier_id, tierName: t.tier_name, 
      buyerName: t.buyer_name, buyerEmail: t.buyer_email, buyerPhone: t.buyer_phone, 
      qrCode: t.qr_code, purchaseDate: t.purchase_date,
      sellerId: t.seller_id, sellerName: t.seller_name, sellerCode: t.seller_code,
      isUsed: Boolean(t.is_used), usedAt: t.used_at, paymentMethod: t.payment_method,
      price: t.price,
    }));
  }),

  create: publicProcedure.input(z.object({
    eventId: z.string(), tierId: z.string(), buyerName: z.string(),
    buyerEmail: z.string(), buyerPhone: z.string().optional(),
    buyerBirthdate: z.string().optional(),
    buyerGender: z.enum(['male', 'female', 'other', 'prefer_not_say']).optional(),
    buyerCity: z.string().optional(),
    buyerCountry: z.string().optional(),
    buyerLatitude: z.number().optional(),
    buyerLongitude: z.number().optional(),
    sellerCode: z.string().optional(),
    paymentMethod: z.enum(['card', 'googlepay', 'applepay', 'cash']),
  })).mutation(async ({ ctx, input }) => {
    const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId);
    if (!tier) throw new Error('Tipo de entrada no encontrado');
    if (tier.sold >= tier.quantity) throw new Error('Entradas agotadas');

    const event = ctx.db.prepare('SELECT * FROM events WHERE id = ?').get(input.eventId);
    if (!event) throw new Error('Evento no encontrado');

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
      buyer_birthdate, buyer_gender, buyer_city, buyer_country, buyer_latitude, buyer_longitude,
      qr_code, seller_id, seller_code, payment_method, price, platform_fee, promoter_amount, seller_commission)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ticketId, input.eventId, input.tierId, input.buyerName, input.buyerEmail,
      input.buyerPhone || null, input.buyerBirthdate || null, input.buyerGender || null,
      input.buyerCity || null, input.buyerCountry || null,
      input.buyerLatitude || null, input.buyerLongitude || null,
      qrCode, seller?.id || null,
      input.sellerCode?.toUpperCase() || null, input.paymentMethod,
      tier.price, platformFee, promoterAmount, sellerCommission
    );

    ctx.db.prepare('UPDATE ticket_tiers SET sold = sold + 1 WHERE id = ?').run(input.tierId);

    if (seller) {
      ctx.db.prepare('UPDATE sellers SET total_sales = total_sales + 1, total_revenue = total_revenue + ? WHERE id = ?')
        .run(tier.price, seller.id);
    }

    // Enviar email con las entradas
    sendTicketEmail(
      input.buyerEmail,
      input.buyerName,
      [{ id: ticketId, qrCode, price: tier.price }],
      { name: event.name, date: event.date, time: event.time, venue: event.venue, location: event.location },
      tier.name
    ).catch(err => console.error('Error enviando email:', err));

    return { id: ticketId, qrCode, price: tier.price, success: true };
  }),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    console.log('[TICKETS] Eliminando entrada:', input.id);
    
    try {
      const ticket = ctx.db.prepare('SELECT * FROM tickets WHERE id = ?').get(input.id);
      if (!ticket) {
        console.error('[TICKETS] Entrada no encontrada:', input.id);
        throw new Error('Entrada no encontrada');
      }
      
      console.log('[TICKETS] Entrada encontrada:', { id: ticket.id, tierId: ticket.tier_id, sellerId: ticket.seller_id });
      
      // Decrementar el contador de vendidos en el tier
      const tierResult = ctx.db.prepare('UPDATE ticket_tiers SET sold = sold - 1 WHERE id = ? AND sold > 0').run(ticket.tier_id);
      console.log('[TICKETS] Tier actualizado:', tierResult.changes);
      
      // Si hay vendedor, decrementar sus estadísticas
      if (ticket.seller_id) {
        const sellerResult = ctx.db.prepare('UPDATE sellers SET total_sales = total_sales - 1, total_revenue = total_revenue - ? WHERE id = ? AND total_sales > 0')
          .run(ticket.price, ticket.seller_id);
        console.log('[TICKETS] Vendedor actualizado:', sellerResult.changes);
      }
      
      // Eliminar la entrada
      const deleteResult = ctx.db.prepare('DELETE FROM tickets WHERE id = ?').run(input.id);
      console.log('[TICKETS] Entrada eliminada:', deleteResult.changes);
      
      if (deleteResult.changes === 0) {
        throw new Error('No se pudo eliminar la entrada');
      }
      
      console.log('[TICKETS] Entrada eliminada exitosamente:', input.id);
      return { success: true };
    } catch (error) {
      console.error('[TICKETS] Error eliminando entrada:', error);
      throw new Error(error.message || 'Error al eliminar la entrada');
    }
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

  login: publicProcedure.input(z.object({
    code: z.string(),
  })).mutation(({ ctx, input }) => {
    const seller = ctx.db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(input.code.toUpperCase());
    if (!seller) {
      throw new Error('Código de vendedor no encontrado o inactivo');
    }
    const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id);
    return {
      success: true,
      seller: {
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
          minSales: c.min_sales, maxSales: c.max_sales, percentage: c.percentage,
        })),
      },
    };
  }),

  getDashboard: publicProcedure.input(z.object({
    sellerId: z.string(),
  })).query(({ ctx, input }) => {
    const seller = ctx.db.prepare('SELECT * FROM sellers WHERE id = ? AND is_active = 1').get(input.sellerId);
    if (!seller) throw new Error('Vendedor no encontrado');

    const commissions = ctx.db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id);
    
    // Calcular comisión actual basada en ventas totales
    let currentCommissionPercent = 0;
    for (const comm of commissions) {
      if (seller.total_sales >= comm.min_sales && (comm.max_sales === null || seller.total_sales < comm.max_sales)) {
        currentCommissionPercent = comm.percentage;
        break;
      }
    }

    // Estadísticas de hoy
    const todayStats = ctx.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue, COALESCE(SUM(seller_commission), 0) as commission
      FROM tickets WHERE seller_id = ? AND date(purchase_date) = date('now')
    `).get(input.sellerId);

    // Estadísticas de esta semana
    const weekStats = ctx.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue, COALESCE(SUM(seller_commission), 0) as commission
      FROM tickets WHERE seller_id = ? AND purchase_date >= date('now', '-7 days')
    `).get(input.sellerId);

    // Estadísticas de este mes
    const monthStats = ctx.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue, COALESCE(SUM(seller_commission), 0) as commission
      FROM tickets WHERE seller_id = ? AND purchase_date >= date('now', 'start of month')
    `).get(input.sellerId);

    // Estadísticas totales
    const totalStats = ctx.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue, COALESCE(SUM(seller_commission), 0) as commission
      FROM tickets WHERE seller_id = ?
    `).get(input.sellerId);

    // Ventas por día (últimos 30 días)
    const dailySales = ctx.db.prepare(`
      SELECT date(purchase_date) as date, COUNT(*) as count, 
             COALESCE(SUM(price), 0) as revenue, COALESCE(SUM(seller_commission), 0) as commission
      FROM tickets WHERE seller_id = ? AND purchase_date >= date('now', '-30 days')
      GROUP BY date(purchase_date)
      ORDER BY date DESC
    `).all(input.sellerId);

    // Ventas por evento
    const salesByEvent = ctx.db.prepare(`
      SELECT e.id, e.name as eventName, e.date as eventDate, e.venue,
             COUNT(t.id) as ticketsSold, COALESCE(SUM(t.price), 0) as revenue,
             COALESCE(SUM(t.seller_commission), 0) as commission
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.seller_id = ?
      GROUP BY e.id
      ORDER BY e.date DESC
    `).all(input.sellerId);

    // Próximo tramo de comisión
    let nextTier = null;
    for (const comm of commissions) {
      if (seller.total_sales < comm.min_sales) {
        nextTier = {
          minSales: comm.min_sales,
          percentage: comm.percentage,
          salesNeeded: comm.min_sales - seller.total_sales,
        };
        break;
      }
    }

    return {
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        code: seller.code,
        totalSales: seller.total_sales,
        totalRevenue: seller.total_revenue,
      },
      currentCommissionPercent,
      commissionTiers: commissions.map(c => ({
        minSales: c.min_sales, maxSales: c.max_sales, percentage: c.percentage,
      })),
      nextTier,
      stats: {
        today: { sales: todayStats.count, revenue: todayStats.revenue, commission: todayStats.commission },
        week: { sales: weekStats.count, revenue: weekStats.revenue, commission: weekStats.commission },
        month: { sales: monthStats.count, revenue: monthStats.revenue, commission: monthStats.commission },
        total: { sales: totalStats.count, revenue: totalStats.revenue, commission: totalStats.commission },
      },
      dailySales: dailySales.map(d => ({
        date: d.date, sales: d.count, revenue: d.revenue, commission: d.commission,
      })),
      salesByEvent: salesByEvent.map(e => ({
        id: e.id, eventName: e.eventName, eventDate: e.eventDate, venue: e.venue,
        ticketsSold: e.ticketsSold, revenue: e.revenue, commission: e.commission,
      })),
    };
  }),

  getSalesHistory: publicProcedure.input(z.object({
    sellerId: z.string(),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
  })).query(({ ctx, input }) => {
    const tickets = ctx.db.prepare(`
      SELECT t.*, e.name as event_name, e.date as event_date, e.venue,
             tt.name as tier_name
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      JOIN ticket_tiers tt ON t.tier_id = tt.id
      WHERE t.seller_id = ?
      ORDER BY t.purchase_date DESC
      LIMIT ? OFFSET ?
    `).all(input.sellerId, input.limit, input.offset);

    const totalCount = ctx.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE seller_id = ?').get(input.sellerId);

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
        sellerCommission: t.seller_commission,
        purchaseDate: t.purchase_date,
        isUsed: Boolean(t.is_used),
      })),
      total: totalCount.count,
      hasMore: input.offset + input.limit < totalCount.count,
    };
  }),

  getPayouts: publicProcedure.input(z.object({
    sellerId: z.string(),
  })).query(({ ctx, input }) => {
    const payouts = ctx.db.prepare('SELECT * FROM seller_payouts WHERE seller_id = ? ORDER BY created_at DESC').all(input.sellerId);
    
    const pendingCommission = ctx.db.prepare(`
      SELECT COALESCE(SUM(seller_commission), 0) as total
      FROM tickets 
      WHERE seller_id = ? AND purchase_date > COALESCE(
        (SELECT MAX(completed_at) FROM seller_payouts WHERE seller_id = ? AND status = 'completed'), '1970-01-01'
      )
    `).get(input.sellerId, input.sellerId);

    return {
      payouts: payouts.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        createdAt: p.created_at,
        completedAt: p.completed_at,
      })),
      pendingCommission: pendingCommission.total,
    };
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

  update: publicProcedure.input(z.object({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional(),
    commissionTiers: z.array(z.object({
      minSales: z.number(),
      maxSales: z.number().nullable(),
      percentage: z.number(),
    })).optional(),
  })).mutation(({ ctx, input }) => {
    const { id, commissionTiers, ...updates } = input;
    const fields = []; const values = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
    
    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP'); values.push(id);
      ctx.db.prepare(`UPDATE sellers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    if (commissionTiers && commissionTiers.length > 0) {
      ctx.db.prepare('DELETE FROM seller_commissions WHERE seller_id = ?').run(id);
      const insertComm = ctx.db.prepare('INSERT INTO seller_commissions (id, seller_id, min_sales, max_sales, percentage) VALUES (?, ?, ?, ?, ?)');
      for (const tier of commissionTiers) {
        insertComm.run(`comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, id, tier.minSales, tier.maxSales, tier.percentage);
      }
    }

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
      commissionPercentage: p.commission_percentage, billingModel: p.billing_model || 'commission',
      isActive: Boolean(p.is_active),
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
      commissionPercentage: promoter.commission_percentage, billingModel: promoter.billing_model || 'commission',
      isActive: Boolean(promoter.is_active),
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
    commissionPercentage: z.number().min(0).max(100).optional(), 
    billingModel: z.enum(['commission', 'subscription']).optional(),
    isActive: z.boolean().optional(),
  })).mutation(({ ctx, input }) => {
    const { id, ...updates } = input;
    const fields = []; const values = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.companyName !== undefined) { fields.push('company_name = ?'); values.push(updates.companyName); }
    if (updates.taxId !== undefined) { fields.push('tax_id = ?'); values.push(updates.taxId); }
    if (updates.commissionPercentage !== undefined) { fields.push('commission_percentage = ?'); values.push(updates.commissionPercentage); }
    if (updates.billingModel !== undefined) { fields.push('billing_model = ?'); values.push(updates.billingModel); }
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
  })).mutation(async ({ ctx, input }) => {
    if (!stripe) {
      throw new Error('Stripe no está configurado. Contacta al administrador.');
    }

    const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId);
    if (!tier) throw new Error('Tipo de entrada no encontrado');
    if (tier.sold + input.quantity > tier.quantity) throw new Error('No hay suficientes entradas disponibles');

    const event = ctx.db.prepare(`SELECT e.*, p.stripe_account_id, p.commission_percentage
      FROM events e LEFT JOIN promoters p ON e.promoter_id = p.id WHERE e.id = ?`).get(input.eventId);
    if (!event) throw new Error('Evento no encontrado');

    const totalAmount = tier.price * input.quantity;
    
    // Get platform commission from settings
    const platformCommissionSetting = ctx.db.prepare("SELECT value FROM settings WHERE key = 'platform_commission'").get();
    const platformCommissionPercent = parseFloat(platformCommissionSetting?.value || '5');
    const platformFee = totalAmount * (platformCommissionPercent / 100);
    const promoterAmount = totalAmount - platformFee;

    const amountInCents = Math.round(totalAmount * 100);
    const platformFeeInCents = Math.round(platformFee * 100);

    console.log('[STRIPE] Creating PaymentIntent:', {
      amount: amountInCents,
      platformFee: platformFeeInCents,
      eventId: input.eventId,
      buyerEmail: input.buyerEmail,
    });

    try {
      // Pago simple - todo va a la cuenta principal de Stripe
      const paymentIntentParams = {
        amount: amountInCents,
        currency: 'eur',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          eventId: input.eventId,
          tierId: input.tierId,
          quantity: String(input.quantity),
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          buyerPhone: input.buyerPhone || '',
          sellerCode: input.sellerCode || '',
          platformFee: String(platformFee),
          promoterAmount: String(promoterAmount),
        },
        receipt_email: input.buyerEmail,
        description: `${input.quantity}x entradas para ${event.name}`,
      };

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

      console.log('[STRIPE] PaymentIntent created:', paymentIntent.id);

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amountInCents,
        currency: 'eur',
        platformFee: platformFeeInCents,
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
    } catch (error) {
      console.error('[STRIPE] Error creating PaymentIntent:', error);
      throw new Error(`Error al crear el pago: ${error.message}`);
    }
  }),

  confirmPayment: publicProcedure.input(z.object({
    paymentIntentId: z.string(),
    eventId: z.string(),
    tierId: z.string(),
    quantity: z.number().min(1),
    buyerName: z.string(),
    buyerEmail: z.string(),
    buyerPhone: z.string().optional(),
    buyerBirthdate: z.string().optional(),
    buyerGender: z.enum(['male', 'female', 'other', 'prefer_not_say']).optional(),
    buyerCity: z.string().optional(),
    buyerCountry: z.string().optional(),
    buyerLatitude: z.number().optional(),
    buyerLongitude: z.number().optional(),
    sellerCode: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // IMPORTANTE: Verificar que el pago fue exitoso en Stripe antes de crear entradas
    if (!stripe) {
      throw new Error('Stripe no está configurado. Contacta al administrador.');
    }

    // Verificar estado del PaymentIntent con Stripe
    console.log('[STRIPE] Verificando PaymentIntent:', input.paymentIntentId);
    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      console.error('[STRIPE] PaymentIntent no completado:', paymentIntent.status);
      throw new Error(`El pago no se ha completado. Estado: ${paymentIntent.status}`);
    }

    // Verificar que no se hayan creado entradas ya para este PaymentIntent (evitar duplicados)
    const existingTickets = ctx.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE payment_intent_id = ?').get(input.paymentIntentId);
    if (existingTickets.count > 0) {
      console.log('[STRIPE] Entradas ya creadas para este PaymentIntent');
      const tickets = ctx.db.prepare('SELECT id, qr_code as qrCode, price FROM tickets WHERE payment_intent_id = ?').all(input.paymentIntentId);
      return { success: true, tickets, total: tickets.reduce((sum, t) => sum + t.price, 0), alreadyProcessed: true };
    }

    console.log('[STRIPE] PaymentIntent verificado exitosamente:', paymentIntent.id);

    const tier = ctx.db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(input.tierId);
    if (!tier) throw new Error('Tipo de entrada no encontrado');

    const event = ctx.db.prepare('SELECT * FROM events WHERE id = ?').get(input.eventId);
    if (!event) throw new Error('Evento no encontrado');

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
        buyer_birthdate, buyer_gender, buyer_city, buyer_country, buyer_latitude, buyer_longitude,
        qr_code, seller_id, seller_code, payment_method, payment_intent_id, price, platform_fee, promoter_amount, seller_commission)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        ticketId, input.eventId, input.tierId, input.buyerName, input.buyerEmail,
        input.buyerPhone || null, input.buyerBirthdate || null, input.buyerGender || null,
        input.buyerCity || null, input.buyerCountry || null,
        input.buyerLatitude || null, input.buyerLongitude || null,
        qrCode, seller?.id || null,
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

    // Enviar email con las entradas
    sendTicketEmail(
      input.buyerEmail,
      input.buyerName,
      tickets,
      { name: event.name, date: event.date, time: event.time, venue: event.venue, location: event.location },
      tier.name
    ).catch(err => console.error('Error enviando email:', err));

    return { success: true, tickets, total: tier.price * input.quantity };
  }),

  getPromoterPayouts: publicProcedure.input(z.object({ promoterId: z.string() })).query(({ ctx, input }) => {
    const payouts = ctx.db.prepare('SELECT * FROM promoter_payouts WHERE promoter_id = ? ORDER BY created_at DESC').all(input.promoterId);
    return payouts.map(p => ({
      id: p.id, amount: p.amount, status: p.status,
      method: p.stripe_transfer_id, createdAt: p.created_at, completedAt: p.completed_at,
    }));
  }),

  // Listar todos los payouts (para admin)
  listPayouts: publicProcedure.query(({ ctx }) => {
    const payouts = ctx.db.prepare(`
      SELECT pp.*, p.name as promoter_name, p.email as promoter_email
      FROM promoter_payouts pp
      JOIN promoters p ON pp.promoter_id = p.id
      ORDER BY pp.created_at DESC
      LIMIT 100
    `).all();
    return payouts.map(p => ({
      id: p.id, 
      promoterId: p.promoter_id,
      promoterName: p.promoter_name,
      promoterEmail: p.promoter_email,
      amount: p.amount, 
      status: p.status,
      method: p.stripe_transfer_id,
      stripeTransferId: p.stripe_transfer_id, 
      createdAt: p.created_at, 
      completedAt: p.completed_at,
    }));
  }),

  // Listar promotores con sus balances (para admin)
  listPromoterBalances: publicProcedure.query(({ ctx }) => {
    const promoters = ctx.db.prepare(`
      SELECT p.*,
        (SELECT COALESCE(SUM(t.promoter_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.promoter_id = p.id) as total_earnings,
        (SELECT COALESCE(SUM(amount), 0) FROM promoter_payouts WHERE promoter_id = p.id AND status = 'completed') as total_paid,
        (SELECT COALESCE(SUM(amount), 0) FROM promoter_payouts WHERE promoter_id = p.id AND status = 'pending') as pending_payouts
      FROM promoters p
      WHERE p.is_active = 1
      ORDER BY p.name
    `).all();
    return promoters.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      companyName: p.company_name,
      totalEarnings: p.total_earnings || 0,
      totalPaid: p.total_paid || 0,
      pendingPayouts: p.pending_payouts || 0,
      availableBalance: (p.total_earnings || 0) - (p.total_paid || 0) - (p.pending_payouts || 0),
    }));
  }),

  // Payout manual - registro de pagos hechos fuera de Stripe
  createPayout: publicProcedure.input(z.object({
    promoterId: z.string(), 
    amount: z.number().min(1),
    method: z.enum(['bank_transfer', 'cash', 'other']).optional(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const promoter = ctx.db.prepare('SELECT * FROM promoters WHERE id = ?').get(input.promoterId);
    if (!promoter) throw new Error('Promotor no encontrado');

    const payoutId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    ctx.db.prepare(`INSERT INTO promoter_payouts (id, promoter_id, amount, stripe_transfer_id, status, completed_at) VALUES (?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`)
      .run(payoutId, input.promoterId, input.amount, input.method || 'bank_transfer');

    console.log('[PAYOUT] Payout registrado:', payoutId, 'Método:', input.method || 'bank_transfer');
    return { id: payoutId, success: true };
  }),

  // Marcar payout como pendiente (para registrar deudas)
  createPendingPayout: publicProcedure.input(z.object({
    promoterId: z.string(), 
    amount: z.number().min(1),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const promoter = ctx.db.prepare('SELECT * FROM promoters WHERE id = ?').get(input.promoterId);
    if (!promoter) throw new Error('Promotor no encontrado');

    const payoutId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    ctx.db.prepare(`INSERT INTO promoter_payouts (id, promoter_id, amount, status) VALUES (?, ?, ?, 'pending')`)
      .run(payoutId, input.promoterId, input.amount);

    console.log('[PAYOUT] Payout pendiente registrado:', payoutId);
    return { id: payoutId, success: true };
  }),

  // Completar un payout pendiente
  completePayout: publicProcedure.input(z.object({
    payoutId: z.string(),
    method: z.enum(['bank_transfer', 'cash', 'other']).optional(),
  })).mutation(async ({ ctx, input }) => {
    ctx.db.prepare(`UPDATE promoter_payouts SET status = 'completed', stripe_transfer_id = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(input.method || 'bank_transfer', input.payoutId);

    console.log('[PAYOUT] Payout completado:', input.payoutId);
    return { success: true };
  }),

  // Obtener balance pendiente de un promotor
  getPromoterBalance: publicProcedure.input(z.object({
    promoterId: z.string(),
  })).query(({ ctx, input }) => {
    const promoter = ctx.db.prepare('SELECT * FROM promoters WHERE id = ?').get(input.promoterId);
    if (!promoter) throw new Error('Promotor no encontrado');

    // Calcular ganancias totales del promotor
    const earnings = ctx.db.prepare(`
      SELECT COALESCE(SUM(t.promoter_amount), 0) as total
      FROM tickets t 
      JOIN events e ON t.event_id = e.id 
      WHERE e.promoter_id = ?
    `).get(input.promoterId);

    // Calcular pagos ya realizados
    const paidOut = ctx.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM promoter_payouts 
      WHERE promoter_id = ? AND status = 'completed'
    `).get(input.promoterId);

    // Pagos pendientes de procesar
    const pendingPayouts = ctx.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM promoter_payouts 
      WHERE promoter_id = ? AND status = 'pending'
    `).get(input.promoterId);

    const totalEarnings = earnings.total || 0;
    const totalPaid = paidOut.total || 0;
    const totalPending = pendingPayouts.total || 0;
    const availableBalance = totalEarnings - totalPaid - totalPending;

    return {
      totalEarnings,
      totalPaid,
      pendingPayouts: totalPending,
      availableBalance,
    };
  }),
});

const statsRouter = createTRPCRouter({
  getDashboardStats: publicProcedure.query(({ ctx }) => {
    const totalStats = ctx.db.prepare(`SELECT COUNT(*) as total_tickets,
      COALESCE(SUM(price), 0) as total_revenue, COALESCE(SUM(platform_fee), 0) as platform_earnings
      FROM tickets`).get();
    const activeEvents = ctx.db.prepare('SELECT COUNT(*) as active_events FROM events WHERE is_active = 1').get();
    const eventStats = ctx.db.prepare('SELECT COUNT(*) as total_events FROM events').get();

    return {
      totalRevenue: totalStats.total_revenue,
      totalTicketsSold: totalStats.total_tickets,
      platformEarnings: totalStats.platform_earnings,
      activeEvents: activeEvents.active_events,
      totalEvents: eventStats.total_events,
    };
  }),

  getBuyerAnalytics: publicProcedure.query(({ ctx }) => {
    // Análisis por género
    const genderStats = ctx.db.prepare(`
      SELECT buyer_gender as gender, COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM tickets WHERE buyer_gender IS NOT NULL
      GROUP BY buyer_gender
    `).all();

    // Análisis por edad (tramos)
    const ageStats = ctx.db.prepare(`
      SELECT 
        CASE 
          WHEN (strftime('%Y', 'now') - strftime('%Y', buyer_birthdate)) < 18 THEN 'under_18'
          WHEN (strftime('%Y', 'now') - strftime('%Y', buyer_birthdate)) BETWEEN 18 AND 24 THEN '18-24'
          WHEN (strftime('%Y', 'now') - strftime('%Y', buyer_birthdate)) BETWEEN 25 AND 34 THEN '25-34'
          WHEN (strftime('%Y', 'now') - strftime('%Y', buyer_birthdate)) BETWEEN 35 AND 44 THEN '35-44'
          WHEN (strftime('%Y', 'now') - strftime('%Y', buyer_birthdate)) BETWEEN 45 AND 54 THEN '45-54'
          WHEN (strftime('%Y', 'now') - strftime('%Y', buyer_birthdate)) >= 55 THEN '55+'
          ELSE 'unknown'
        END as age_range,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM tickets WHERE buyer_birthdate IS NOT NULL
      GROUP BY age_range
      ORDER BY 
        CASE age_range
          WHEN 'under_18' THEN 1
          WHEN '18-24' THEN 2
          WHEN '25-34' THEN 3
          WHEN '35-44' THEN 4
          WHEN '45-54' THEN 5
          WHEN '55+' THEN 6
          ELSE 7
        END
    `).all();

    // Análisis por ciudad
    const cityStats = ctx.db.prepare(`
      SELECT buyer_city as city, buyer_country as country, COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM tickets WHERE buyer_city IS NOT NULL
      GROUP BY buyer_city, buyer_country
      ORDER BY count DESC
      LIMIT 20
    `).all();

    // Análisis por país
    const countryStats = ctx.db.prepare(`
      SELECT buyer_country as country, COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM tickets WHERE buyer_country IS NOT NULL
      GROUP BY buyer_country
      ORDER BY count DESC
    `).all();

    // Ubicaciones para el mapa (solo tickets con coordenadas)
    const locations = ctx.db.prepare(`
      SELECT buyer_city as city, buyer_country as country, 
             buyer_latitude as latitude, buyer_longitude as longitude,
             COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM tickets 
      WHERE buyer_latitude IS NOT NULL AND buyer_longitude IS NOT NULL
      GROUP BY buyer_city, buyer_country, buyer_latitude, buyer_longitude
      ORDER BY count DESC
      LIMIT 100
    `).all();

    // Totales
    const totals = ctx.db.prepare(`
      SELECT COUNT(*) as total_tickets,
             COUNT(DISTINCT buyer_email) as unique_buyers,
             COALESCE(SUM(price), 0) as total_revenue,
             COUNT(buyer_gender) as with_gender,
             COUNT(buyer_birthdate) as with_birthdate,
             COUNT(buyer_city) as with_location
      FROM tickets
    `).get();

    // Ventas por mes (últimos 12 meses)
    const monthlySales = ctx.db.prepare(`
      SELECT strftime('%Y-%m', purchase_date) as month,
             COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM tickets
      WHERE purchase_date >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month ASC
    `).all();

    // Ventas por día de la semana
    const weekdaySales = ctx.db.prepare(`
      SELECT strftime('%w', purchase_date) as weekday,
             COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM tickets
      GROUP BY weekday
      ORDER BY weekday
    `).all();

    // Ventas por hora del día
    const hourlySales = ctx.db.prepare(`
      SELECT strftime('%H', purchase_date) as hour,
             COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM tickets
      GROUP BY hour
      ORDER BY hour
    `).all();

    return {
      gender: genderStats.map(g => ({ gender: g.gender, count: g.count, revenue: g.revenue })),
      ageRanges: ageStats.map(a => ({ range: a.age_range, count: a.count, revenue: a.revenue })),
      cities: cityStats.map(c => ({ city: c.city, country: c.country, count: c.count, revenue: c.revenue })),
      countries: countryStats.map(c => ({ country: c.country, count: c.count, revenue: c.revenue })),
      locations: locations.map(l => ({ city: l.city, country: l.country, latitude: l.latitude, longitude: l.longitude, count: l.count, revenue: l.revenue })),
      totals: {
        totalTickets: totals.total_tickets,
        uniqueBuyers: totals.unique_buyers,
        totalRevenue: totals.total_revenue,
        withGender: totals.with_gender,
        withBirthdate: totals.with_birthdate,
        withLocation: totals.with_location,
      },
      monthlySales: monthlySales.map(m => ({ month: m.month, count: m.count, revenue: m.revenue })),
      weekdaySales: weekdaySales.map(w => ({ weekday: parseInt(w.weekday), count: w.count, revenue: w.revenue })),
      hourlySales: hourlySales.map(h => ({ hour: parseInt(h.hour), count: h.count, revenue: h.revenue })),
    };
  }),

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
    const topSellers = ctx.db.prepare(`SELECT s.id, s.name, s.code, s.total_sales, s.total_revenue
      FROM sellers s WHERE s.is_active = 1 ORDER BY s.total_sales DESC LIMIT 5`).all();

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
      topSellers: topSellers.map(s => ({ id: s.id, name: s.name, code: s.code, totalSales: s.total_sales, totalRevenue: s.total_revenue })),
    };
  }),
});

const settingsRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    console.log('[SETTINGS] getAll called');
    try {
      const settings = ctx.db.prepare('SELECT * FROM settings').all();
      const result = {};
      for (const s of settings) result[s.key] = s.value;
      console.log('[SETTINGS] Returning settings:', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('[SETTINGS] Error getting settings:', error);
      throw new Error('Error al obtener configuración: ' + error.message);
    }
  }),
  
  set: publicProcedure.input(z.object({ key: z.string(), value: z.string() })).mutation(({ ctx, input }) => {
    console.log('[SETTINGS] set called:', input.key, '=', input.value);
    try {
      // Guardar directamente sin transacción para simplicidad
      ctx.db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(input.key, String(input.value));
      
      // Forzar sync al disco
      ctx.db.pragma('wal_checkpoint(TRUNCATE)');
      
      const saved = ctx.db.prepare('SELECT value FROM settings WHERE key = ?').get(input.key);
      console.log('[SETTINGS] Verified saved value:', input.key, '=', saved?.value);
      
      return { success: true, savedValue: saved?.value };
    } catch (error) {
      console.error('[SETTINGS] Error saving setting:', error);
      throw new Error('Error al guardar configuración: ' + error.message);
    }
  }),
  
  setMultiple: publicProcedure.input(z.record(z.string(), z.string())).mutation(({ ctx, input }) => {
    console.log('');
    console.log('========================================');
    console.log('[SETTINGS] GUARDANDO CONFIGURACIÓN');
    console.log('========================================');
    console.log('[SETTINGS] Datos recibidos:', JSON.stringify(input, null, 2));
    
    try {
      // Guardar cada setting directamente
      for (const [key, value] of Object.entries(input)) {
        console.log(`[SETTINGS] Guardando: ${key} = ${value}`);
        ctx.db.prepare(`
          INSERT INTO settings (key, value, updated_at) 
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET 
            value = excluded.value, 
            updated_at = CURRENT_TIMESTAMP
        `).run(key, String(value));
      }
      
      // Forzar escritura INMEDIATA al disco
      ctx.db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('[SETTINGS] WAL checkpoint TRUNCATE completado');
      
      // Verificar que se guardaron correctamente
      const allSettings = ctx.db.prepare('SELECT key, value FROM settings').all();
      const savedValues = {};
      for (const s of allSettings) {
        savedValues[s.key] = s.value;
      }
      
      console.log('');
      console.log('[SETTINGS] VERIFICACIÓN - Valores en DB:');
      let allOk = true;
      for (const [key, value] of Object.entries(input)) {
        const saved = savedValues[key];
        const match = saved === String(value);
        if (!match) allOk = false;
        console.log(`  ${match ? '✓' : '✗'} ${key}: ${saved} (esperado: ${value})`);
      }
      console.log('========================================');
      console.log('');
      
      if (!allOk) {
        console.error('[SETTINGS] ERROR: Algunos valores no coinciden después del guardado');
        throw new Error('Algunos valores no se guardaron correctamente');
      }
      
      return { success: true, savedValues };
    } catch (error) {
      console.error('[SETTINGS] ERROR al guardar:', error);
      console.error('[SETTINGS] Stack:', error.stack);
      throw new Error('Error al guardar configuración: ' + error.message);
    }
  }),
  
  debug: publicProcedure.query(({ ctx }) => {
    try {
      const dbPath = process.env.DATABASE_PATH || 'unknown';
      const settings = ctx.db.prepare('SELECT * FROM settings').all();
      const tableInfo = ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      
      return {
        dbPath,
        settingsCount: settings.length,
        settings: settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}),
        tables: tableInfo.map(t => t.name),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return { error: error.message };
    }
  }),
});

function generateInvitationCode() {
  return 'INV-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ionos.es',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendVerificationEmail(email, code, name) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log('⚠️  SMTP no configurado - Código mostrado solo en logs');
    console.log(`📧 Email: ${email} | Código: ${code}`);
    return false;
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await smtpTransporter.sendMail({
      from: `"TicketZone" <${fromEmail}>`,
      to: email,
      subject: 'Verifica tu cuenta - TicketZone',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 30px; text-align: center; }
            .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; background: #f0f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎟️ TicketZone</h1>
            </div>
            <div class="content">
              <h2>¡Hola ${name}!</h2>
              <p>Usa este código para verificar tu cuenta:</p>
              <div class="code">${code}</div>
              <p style="color: #666;">El código expira en 30 minutos.</p>
            </div>
            <div class="footer">
              <p>Si no solicitaste esta verificación, ignora este email.</p>
              <p>© ${new Date().getFullYear()} TicketZone</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`✅ Email de verificación enviado a: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    console.log(`📧 Código de respaldo - Email: ${email} | Código: ${code}`);
    return false;
  }
}

async function sendTicketEmail(buyerEmail, buyerName, tickets, event, tierName) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log('⚠️  SMTP no configurado - Email de entradas no enviado');
    console.log(`📧 Entradas para: ${buyerEmail}`);
    tickets.forEach(t => console.log(`   QR: ${t.qrCode}`));
    return false;
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

  const ticketsHtml = tickets.map((ticket, index) => `
    <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 15px 0; border: 2px dashed #667eea;">
      <div style="text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Entrada ${index + 1} de ${tickets.length}</p>
        <div style="background: white; padding: 15px; border-radius: 8px; display: inline-block;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.qrCode)}" 
               alt="QR Code" style="width: 180px; height: 180px;" />
        </div>
        <p style="margin: 15px 0 5px 0; font-size: 12px; color: #888;">Código:</p>
        <p style="margin: 0; font-size: 14px; font-weight: bold; color: #333; font-family: monospace;">${ticket.qrCode}</p>
      </div>
    </div>
  `).join('');

  try {
    await smtpTransporter.sendMail({
      from: `"TicketZone" <${fromEmail}>`,
      to: buyerEmail,
      subject: `🎟️ Tus entradas para ${event.name} - TicketZone`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">🎟️ TicketZone</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Confirmación de compra</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="margin: 0 0 5px 0; color: #333;">¡Hola ${buyerName}!</h2>
              <p style="color: #666; margin: 0 0 25px 0;">Tu compra se ha realizado con éxito. Aquí tienes tus entradas:</p>
              
              <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px 0; color: #667eea;">📍 Detalles del evento</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 14px;">Evento:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${event.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 14px;">Fecha:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 14px;">Hora:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${event.time}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 14px;">Lugar:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${event.venue}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 14px;">Dirección:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${event.location}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 14px;">Tipo de entrada:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${tierName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 14px;">Cantidad:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${tickets.length} entrada(s)</td>
                  </tr>
                </table>
              </div>
              
              <h3 style="margin: 0 0 10px 0; color: #333; text-align: center;">🎫 Tus entradas</h3>
              <p style="color: #666; text-align: center; margin: 0 0 20px 0; font-size: 14px;">Presenta estos códigos QR en la entrada del evento</p>
              
              ${ticketsHtml}
              
              <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin-top: 25px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>⚠️ Importante:</strong> Guarda este email. Cada código QR solo puede usarse una vez.
                </p>
              </div>
            </div>
            
            <div style="padding: 20px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee;">
              <p style="margin: 0 0 5px 0;">¿Tienes alguna pregunta? Contacta con el organizador del evento.</p>
              <p style="margin: 0;">© ${new Date().getFullYear()} TicketZone - Todos los derechos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`✅ Email de entradas enviado a: ${buyerEmail} (${tickets.length} entradas)`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de entradas:', error.message);
    return false;
  }
}

const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('[LOGIN] Intento de login para:', input.email.toLowerCase());
      
      const user = ctx.db.prepare(`
        SELECT * FROM users WHERE email = ? AND is_active = 1
      `).get(input.email.toLowerCase());

      if (!user) {
        console.log('[LOGIN] Usuario no encontrado o inactivo');
        throw new Error('Usuario no encontrado o inactivo');
      }

      console.log('[LOGIN] Usuario encontrado:', user.email, '| Rol:', user.role);
      
      const inputHash = hashPassword(input.password);
      console.log('[LOGIN] Hash entrada:', inputHash.substring(0, 20) + '...');
      console.log('[LOGIN] Hash guardado:', user.password_hash.substring(0, 20) + '...');
      console.log('[LOGIN] ¿Coinciden?:', inputHash === user.password_hash);

      if (!verifyPassword(input.password, user.password_hash)) {
        console.log('[LOGIN] Contraseña incorrecta');
        throw new Error('Contraseña incorrecta');
      }

      console.log('[LOGIN] Login exitoso para:', user.email);
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

      ctx.db.prepare('DELETE FROM email_verifications WHERE email = ? AND verified = 0').run(input.email.toLowerCase());

      const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const userData = JSON.stringify({
        email: input.email.toLowerCase(),
        password: input.password,
        name: input.name,
        role: 'buyer',
      });

      ctx.db.prepare(`
        INSERT INTO email_verifications (id, email, code, type, user_data, expires_at)
        VALUES (?, ?, ?, 'user', ?, ?)
      `).run(verificationId, input.email.toLowerCase(), verificationCode, userData, expiresAt);

      await sendVerificationEmail(input.email.toLowerCase(), verificationCode, input.name);

      return {
        success: true,
        requiresVerification: true,
        email: input.email.toLowerCase(),
        message: 'Se ha enviado un código de verificación a tu email',
      };
    }),

  verifyEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const nowISO = new Date().toISOString();
      console.log('[VERIFY] Email:', input.email.toLowerCase(), '| Código:', input.code, '| Ahora:', nowISO);
      
      const verification = ctx.db.prepare(`
        SELECT * FROM email_verifications 
        WHERE email = ? AND code = ? AND verified = 0 AND expires_at > ?
        ORDER BY created_at DESC LIMIT 1
      `).get(input.email.toLowerCase(), input.code, nowISO);
      
      console.log('[VERIFY] Verificación encontrada:', verification ? 'SI' : 'NO');
      if (verification) {
        console.log('[VERIFY] Expira:', verification.expires_at);
      }

      if (!verification) {
        throw new Error('Código de verificación inválido o expirado');
      }

      const userData = JSON.parse(verification.user_data);

      if (verification.type === 'user' || verification.type === 'buyer') {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const passwordHash = hashPassword(userData.password);

        ctx.db.prepare(`
          INSERT INTO users (id, email, password_hash, name, role, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(userId, userData.email, passwordHash, userData.name, userData.role || 'buyer');

        ctx.db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(verification.id);

        return {
          success: true,
          user: {
            id: userId,
            email: userData.email,
            name: userData.name,
            role: userData.role || 'buyer',
          },
        };
      } else if (verification.type === 'promoter') {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const passwordHash = hashPassword(userData.password);

        ctx.db.prepare(`
          INSERT INTO users (id, email, password_hash, name, role, is_active)
          VALUES (?, ?, ?, ?, 'promoter', 1)
        `).run(userId, userData.email, passwordHash, userData.name);

        const promoterId = `promoter_${Date.now()}`;
        ctx.db.prepare(`
          INSERT INTO promoters (id, name, email, phone, is_active)
          VALUES (?, ?, ?, ?, 1)
        `).run(promoterId, userData.name, userData.email, userData.phone || null);

        if (userData.invitationId) {
          ctx.db.prepare('UPDATE invitation_codes SET current_uses = current_uses + 1 WHERE id = ?').run(userData.invitationId);
        }

        ctx.db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(verification.id);

        return {
          success: true,
          user: {
            id: userId,
            email: userData.email,
            name: userData.name,
            role: 'promoter',
          },
        };
      } else if (verification.type === 'seller') {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const passwordHash = hashPassword(userData.password);

        ctx.db.prepare(`
          INSERT INTO users (id, email, password_hash, name, role, is_active)
          VALUES (?, ?, ?, ?, 'seller', 1)
        `).run(userId, userData.email, passwordHash, userData.name);

        const sellerId = `seller_${Date.now()}`;
        const sellerCode = 'RRPP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        ctx.db.prepare(`
          INSERT INTO sellers (id, name, email, phone, code, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(sellerId, userData.name, userData.email, userData.phone || null, sellerCode);

        if (userData.invitationId) {
          ctx.db.prepare('UPDATE invitation_codes SET current_uses = current_uses + 1 WHERE id = ?').run(userData.invitationId);
        }

        ctx.db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(verification.id);

        return {
          success: true,
          user: {
            id: userId,
            email: userData.email,
            name: userData.name,
            role: 'seller',
          },
          sellerCode,
        };
      }

      throw new Error('Tipo de verificación no válido');
    }),

  resendVerificationCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existingVerification = ctx.db.prepare(`
        SELECT * FROM email_verifications 
        WHERE email = ? AND verified = 0 AND expires_at > ?
        ORDER BY created_at DESC LIMIT 1
      `).get(input.email.toLowerCase(), new Date().toISOString());

      if (!existingVerification) {
        throw new Error('No hay verificación pendiente para este email');
      }

      const newCode = generateVerificationCode();
      const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      ctx.db.prepare(`
        UPDATE email_verifications SET code = ?, expires_at = ? WHERE id = ?
      `).run(newCode, newExpiresAt, existingVerification.id);

      const userData = existingVerification.user_data ? JSON.parse(existingVerification.user_data) : { name: 'Usuario' };
      await sendVerificationEmail(input.email.toLowerCase(), newCode, userData.name || 'Usuario');

      return {
        success: true,
        message: 'Se ha reenviado el código de verificación',
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

      ctx.db.prepare('DELETE FROM email_verifications WHERE email = ? AND verified = 0').run(input.email.toLowerCase());

      const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const userData = JSON.stringify({
        email: input.email.toLowerCase(),
        password: input.password,
        name: input.name,
        phone: input.phone || null,
        invitationId: invitation.id,
      });

      ctx.db.prepare(`
        INSERT INTO email_verifications (id, email, code, type, user_data, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(verificationId, input.email.toLowerCase(), verificationCode, invitation.type, userData, expiresAt);

      await sendVerificationEmail(input.email.toLowerCase(), verificationCode, input.name);

      return {
        success: true,
        requiresVerification: true,
        email: input.email.toLowerCase(),
        type: invitation.type,
        message: 'Se ha enviado un código de verificación a tu email',
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
    console.log('[SUBSCRIPTIONS] getPlans called');
    const plans = ctx.db.prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY max_events ASC').all();
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      priceMonthly: p.price,
      maxEvents: p.max_events,
      maxEventsPerMonth: p.max_events,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
      isActive: p.is_active === 1,
      sortOrder: 0,
    }));
  }),

  getAllPlans: publicProcedure.query(({ ctx }) => {
    console.log('[SUBSCRIPTIONS] getAllPlans called');
    const plans = ctx.db.prepare('SELECT * FROM subscription_plans ORDER BY max_events ASC').all();
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      priceMonthly: p.price,
      maxEvents: p.max_events,
      maxEventsPerMonth: p.max_events,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
      isActive: p.is_active === 1,
      sortOrder: 0,
    }));
  }),

  listPlans: publicProcedure.query(({ ctx }) => {
    console.log('[SUBSCRIPTIONS] listPlans called');
    const plans = ctx.db.prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY max_events ASC').all();
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      priceMonthly: p.price,
      maxEvents: p.max_events,
      maxEventsPerMonth: p.max_events,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
      isActive: p.is_active === 1,
      sortOrder: 0,
    }));
  }),

  listAllPlans: publicProcedure.query(({ ctx }) => {
    console.log('[SUBSCRIPTIONS] listAllPlans called');
    const plans = ctx.db.prepare('SELECT * FROM subscription_plans ORDER BY max_events ASC').all();
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      priceMonthly: p.price,
      maxEvents: p.max_events,
      maxEventsPerMonth: p.max_events,
      description: p.description,
      features: p.features ? JSON.parse(p.features) : [],
      isActive: p.is_active === 1,
      sortOrder: 0,
    }));
  }),

  createPlan: publicProcedure
    .input(z.object({
      name: z.string(),
      price: z.number().min(0).optional(),
      priceMonthly: z.number().min(0).optional(),
      maxEvents: z.number().min(1).optional(),
      maxEventsPerMonth: z.number().min(1).optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      console.log('[SUBSCRIPTIONS] createPlan called with:', JSON.stringify(input));
      try {
        const id = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const price = input.priceMonthly ?? input.price ?? 0;
        const maxEvents = input.maxEventsPerMonth ?? input.maxEvents ?? 1;
        
        ctx.db.prepare(`
          INSERT INTO subscription_plans (id, name, price, max_events, description, features, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(id, input.name, price, maxEvents, input.description || '', JSON.stringify(input.features || []));
        
        // Forzar escritura INMEDIATA al disco
        ctx.db.pragma('wal_checkpoint(TRUNCATE)');
        
        // Verificar que se creó
        const created = ctx.db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(id);
        if (!created) {
          throw new Error('El plan no se creó correctamente');
        }
        
        console.log('[SUBSCRIPTIONS] Plan created and verified:', id);
        return { id, success: true };
      } catch (error) {
        console.error('[SUBSCRIPTIONS] Error creating plan:', error);
        throw new Error('Error al crear plan: ' + error.message);
      }
    }),

  updatePlan: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      price: z.number().min(0).optional(),
      priceMonthly: z.number().min(0).optional(),
      maxEvents: z.number().min(1).optional(),
      maxEventsPerMonth: z.number().min(1).optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      console.log('[SUBSCRIPTIONS] updatePlan called with:', JSON.stringify(input));
      try {
        // Verificar que el plan existe
        const existing = ctx.db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(input.id);
        if (!existing) {
          throw new Error('Plan no encontrado');
        }
        
        const updates = [];
        const values = [];

        if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
        const price = input.priceMonthly ?? input.price;
        if (price !== undefined) { updates.push('price = ?'); values.push(price); }
        const maxEvents = input.maxEventsPerMonth ?? input.maxEvents;
        if (maxEvents !== undefined) { updates.push('max_events = ?'); values.push(maxEvents); }
        if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
        if (input.features !== undefined) { updates.push('features = ?'); values.push(JSON.stringify(input.features)); }
        if (input.isActive !== undefined) { updates.push('is_active = ?'); values.push(input.isActive ? 1 : 0); }

        if (updates.length > 0) {
          values.push(input.id);
          const sql = `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`;
          console.log('[SUBSCRIPTIONS] Executing SQL:', sql, 'with values:', values);
          ctx.db.prepare(sql).run(...values);
          
          // Forzar escritura INMEDIATA al disco
          ctx.db.pragma('wal_checkpoint(TRUNCATE)');
          
          // Verificar actualización
          const updated = ctx.db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(input.id);
          console.log('[SUBSCRIPTIONS] Plan updated and verified:', JSON.stringify(updated));
        }
        return { success: true };
      } catch (error) {
        console.error('[SUBSCRIPTIONS] Error updating plan:', error);
        throw new Error('Error al actualizar plan: ' + error.message);
      }
    }),

  deletePlan: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      console.log('[SUBSCRIPTIONS] deletePlan called with:', input.id);
      try {
        // Verificar si hay suscripciones activas
        const activeSubs = ctx.db.prepare(
          'SELECT COUNT(*) as count FROM promoter_subscriptions WHERE plan_id = ? AND status = ?'
        ).get(input.id, 'active');
        
        if (activeSubs && activeSubs.count > 0) {
          throw new Error('No se puede eliminar un plan con suscripciones activas');
        }
        
        ctx.db.prepare('DELETE FROM subscription_plans WHERE id = ?').run(input.id);
        
        // Forzar escritura INMEDIATA al disco
        ctx.db.pragma('wal_checkpoint(TRUNCATE)');
        
        console.log('[SUBSCRIPTIONS] Plan deleted:', input.id);
        return { success: true };
      } catch (error) {
        console.error('[SUBSCRIPTIONS] Error deleting plan:', error);
        throw new Error('Error al eliminar plan: ' + error.message);
      }
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

  getSubscriptionStats: publicProcedure.query(({ ctx }) => {
    const activeSubscriptions = ctx.db.prepare(`
      SELECT COUNT(*) as count FROM promoter_subscriptions WHERE status = 'active'
    `).get();

    const monthlyRevenue = ctx.db.prepare(`
      SELECT COALESCE(SUM(sp.price), 0) as total
      FROM promoter_subscriptions ps
      JOIN subscription_plans sp ON ps.plan_id = sp.id
      WHERE ps.status = 'active'
    `).get();

    const planStats = ctx.db.prepare(`
      SELECT sp.id, sp.name, COUNT(ps.id) as subscribers
      FROM subscription_plans sp
      LEFT JOIN promoter_subscriptions ps ON sp.id = ps.plan_id AND ps.status = 'active'
      GROUP BY sp.id
    `).all();

    return {
      activeSubscriptions: activeSubscriptions?.count || 0,
      monthlyRevenue: monthlyRevenue?.total || 0,
      planStats: planStats.map(p => ({ id: p.id, name: p.name, subscribers: p.subscribers || 0 })),
    };
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

// Stripe Webhook endpoint
app.post('/api/webhooks/stripe', async (c) => {
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  const sig = c.req.header('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  let event;
  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return c.json({ error: `Webhook Error: ${err.message}` }, 400);
  }

  const db = getDatabase();

  console.log('[WEBHOOK] Received event:', event.type);

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      console.log('[WEBHOOK] Payment succeeded:', paymentIntent.id);

      const { eventId, tierId, quantity, buyerName, buyerEmail, buyerPhone, sellerCode } = paymentIntent.metadata;

      if (!eventId || !tierId || !quantity) {
        console.log('[WEBHOOK] Missing metadata, skipping ticket creation');
        break;
      }

      // Check if tickets already created for this payment
      const existingTicket = db.prepare('SELECT id FROM tickets WHERE payment_intent_id = ?').get(paymentIntent.id);
      if (existingTicket) {
        console.log('[WEBHOOK] Tickets already created for this payment');
        break;
      }

      const tier = db.prepare('SELECT * FROM ticket_tiers WHERE id = ?').get(tierId);
      const eventData = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

      if (!tier || !eventData) {
        console.error('[WEBHOOK] Tier or event not found');
        break;
      }

      const tickets = [];
      let seller = null;
      let sellerCommission = 0;

      if (sellerCode) {
        seller = db.prepare('SELECT * FROM sellers WHERE code = ? AND is_active = 1').get(sellerCode.toUpperCase());
        if (seller) {
          const commissions = db.prepare('SELECT * FROM seller_commissions WHERE seller_id = ? ORDER BY min_sales ASC').all(seller.id);
          for (const comm of commissions) {
            if (seller.total_sales >= comm.min_sales && (comm.max_sales === null || seller.total_sales < comm.max_sales)) {
              sellerCommission = tier.price * (comm.percentage / 100);
              break;
            }
          }
        }
      }

      const platformCommissionSetting = db.prepare("SELECT value FROM settings WHERE key = 'platform_commission'").get();
      const platformFee = tier.price * ((parseFloat(platformCommissionSetting?.value || '5') / 100));
      const promoterAmount = tier.price - platformFee - sellerCommission;

      const qty = parseInt(quantity);
      for (let i = 0; i < qty; i++) {
        const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const qrCode = `${eventId}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        db.prepare(`INSERT INTO tickets (id, event_id, tier_id, buyer_name, buyer_email, buyer_phone,
          qr_code, seller_id, seller_code, payment_method, payment_intent_id, price, platform_fee, promoter_amount, seller_commission)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          ticketId, eventId, tierId, buyerName, buyerEmail,
          buyerPhone || null, qrCode, seller?.id || null,
          sellerCode?.toUpperCase() || null, 'card', paymentIntent.id,
          tier.price, platformFee, promoterAmount, sellerCommission
        );

        tickets.push({ id: ticketId, qrCode, price: tier.price });
      }

      db.prepare('UPDATE ticket_tiers SET sold = sold + ? WHERE id = ?').run(qty, tierId);

      if (seller) {
        db.prepare('UPDATE sellers SET total_sales = total_sales + ?, total_revenue = total_revenue + ? WHERE id = ?')
          .run(qty, tier.price * qty, seller.id);
      }

      // Send email
      sendTicketEmail(
        buyerEmail,
        buyerName,
        tickets,
        { name: eventData.name, date: eventData.date, time: eventData.time, venue: eventData.venue, location: eventData.location },
        tier.name
      ).catch(err => console.error('[WEBHOOK] Error sending email:', err));

      console.log('[WEBHOOK] Created', tickets.length, 'tickets');
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      console.log('[WEBHOOK] Payment failed:', paymentIntent.id, paymentIntent.last_payment_error?.message);
      break;
    }

    case 'account.updated': {
      const account = event.data.object;
      console.log('[WEBHOOK] Account updated:', account.id);

      // Update promoter status
      const promoter = db.prepare('SELECT * FROM promoters WHERE stripe_account_id = ?').get(account.id);
      if (promoter) {
        const isActive = account.charges_enabled && account.payouts_enabled;
        db.prepare('UPDATE promoters SET stripe_account_status = ? WHERE id = ?')
          .run(isActive ? 'active' : 'pending', promoter.id);
        console.log('[WEBHOOK] Updated promoter status:', promoter.id, isActive ? 'active' : 'pending');
      }
      break;
    }

    default:
      console.log('[WEBHOOK] Unhandled event type:', event.type);
  }

  return c.json({ received: true });
});

const port = parseInt(process.env.PORT || '3001', 10);

// Inicializar base de datos al arrancar (para mostrar logs)
getDatabase();

console.log('╔═══════════════════════════════════════════╗');
console.log('║     TicketZone Backend Server             ║');
console.log('╚═══════════════════════════════════════════╝');

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`✓ Servidor en http://0.0.0.0:${info.port}`);
  console.log(`✓ API tRPC en http://0.0.0.0:${info.port}/api/trpc`);
  console.log(`✓ Health check en http://0.0.0.0:${info.port}/api/health`);
});
