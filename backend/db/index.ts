import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ticketzone.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const fs = require('fs');
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

function initializeDatabase(db: Database.Database) {
  db.exec(`
    -- Promotores (organizadores de eventos que reciben pagos directos)
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

    -- Eventos
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

    -- Tipos de entrada
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

    -- Vendedores/RRPP
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

    -- Comisiones de vendedores
    CREATE TABLE IF NOT EXISTS seller_commissions (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      min_sales INTEGER NOT NULL,
      max_sales INTEGER,
      percentage REAL NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
    );

    -- Tickets/Entradas
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

    -- Pagos a promotores
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

    -- Pagos a vendedores
    CREATE TABLE IF NOT EXISTS seller_payouts (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (seller_id) REFERENCES sellers(id)
    );

    -- Usuarios admin
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Configuración de la plataforma
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Planes de suscripción
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      max_events_per_month INTEGER NOT NULL,
      price_monthly REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Suscripciones de promotores
    CREATE TABLE IF NOT EXISTS promoter_subscriptions (
      id TEXT PRIMARY KEY,
      promoter_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      current_period_start TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      events_used_this_month INTEGER DEFAULT 0,
      stripe_subscription_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promoter_id) REFERENCES promoters(id),
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    );

    -- Códigos de invitación para registro de promotores y vendedores
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('promoter', 'seller')),
      max_uses INTEGER DEFAULT 1,
      current_uses INTEGER DEFAULT 0,
      expires_at TEXT,
      created_by TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Invitaciones para personal de escaneo de entradas
    CREATE TABLE IF NOT EXISTS scanner_invitations (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      promoter_id TEXT NOT NULL,
      event_id TEXT,
      max_uses INTEGER DEFAULT 1,
      current_uses INTEGER DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promoter_id) REFERENCES promoters(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );

    -- Usuarios escáner (personal de verificación de entradas)
    CREATE TABLE IF NOT EXISTS scanner_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      promoter_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promoter_id) REFERENCES promoters(id)
    );

    -- Relación escáner-eventos (a qué eventos tiene acceso cada escáner)
    CREATE TABLE IF NOT EXISTS scanner_event_access (
      id TEXT PRIMARY KEY,
      scanner_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scanner_id) REFERENCES scanner_users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      UNIQUE(scanner_id, event_id)
    );

    -- Índices para mejor rendimiento
    CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
    CREATE INDEX IF NOT EXISTS idx_tickets_seller ON tickets(seller_id);
    CREATE INDEX IF NOT EXISTS idx_events_promoter ON events(promoter_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event ON ticket_tiers(event_id);
    CREATE INDEX IF NOT EXISTS idx_promoter_subscriptions_promoter ON promoter_subscriptions(promoter_id);
    CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
    CREATE INDEX IF NOT EXISTS idx_scanner_invitations_code ON scanner_invitations(code);
    CREATE INDEX IF NOT EXISTS idx_scanner_users_promoter ON scanner_users(promoter_id);
    CREATE INDEX IF NOT EXISTS idx_scanner_event_access_scanner ON scanner_event_access(scanner_id);
  `);

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('platform_name', 'TicketZone');
    insertSetting.run('platform_commission', '5');
    insertSetting.run('currency', 'EUR');
    insertSetting.run('stripe_enabled', 'true');
    insertSetting.run('early_withdrawal_fee', '2');
    console.log('Default settings created');
  }
  // No resetear valores existentes - mantener la configuración guardada por el admin

  const plansCount = db.prepare('SELECT COUNT(*) as count FROM subscription_plans').get() as { count: number };
  if (plansCount.count === 0) {
    const insertPlan = db.prepare(`
      INSERT INTO subscription_plans (id, name, description, max_events_per_month, price_monthly, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertPlan.run('plan_starter', 'Starter', 'Ideal para empezar con pocos eventos', 3, 29.99, 1);
    insertPlan.run('plan_pro', 'Profesional', 'Para promotores con actividad regular', 10, 79.99, 2);
    insertPlan.run('plan_enterprise', 'Enterprise', 'Eventos ilimitados para grandes promotores', 999, 199.99, 3);
    console.log('Default subscription plans created');
  }

  const crypto = require('crypto');
  const adminPasswordHash = crypto.createHash('sha256').update('admin123').digest('hex');
  
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('devilworks2023@gmail.com') as any;
  
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('admin-1', 'devilworks2023@gmail.com', adminPasswordHash, 'Administrador', 'admin');
    console.log('Admin user created: devilworks2023@gmail.com / admin123');
  } else {
    db.prepare(`
      UPDATE users SET password_hash = ?, name = ?, role = 'admin', is_active = 1 
      WHERE email = ?
    `).run(adminPasswordHash, 'Administrador', 'devilworks2023@gmail.com');
    console.log('Admin user credentials updated: devilworks2023@gmail.com / admin123');
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
