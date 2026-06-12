import { neon } from "@neondatabase/serverless";
import { seedDemoData } from "./seed.js";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Set it in your environment before starting the API.");
}

const sql = neon(DATABASE_URL);

// ── Neon-compatible DB wrapper ────────────────────────────────────────────────
// Translates the SQLite-style .prepare().get/all/run API into async Neon calls.
// The neon() driver's tagged-template function requires sql.query(text, params)
// for dynamic/parameterized queries.
function translateSqliteQuery(query: string): string {
  let counter = 1;
  let pgQuery = query.replace(/\?/g, () => `$${counter++}`);
  pgQuery = pgQuery.replace(
    /datetime\('now',\s*'([+-])(\d+)\s+(days|hours|minutes|seconds)'\)/g,
    (_match, sign: string, amount: string, unit: string) =>
      `NOW() ${sign === "-" ? "-" : "+"} INTERVAL '${amount} ${unit}'`
  );
  pgQuery = pgQuery.replace(/datetime\('now'\)/g, "NOW()");
  pgQuery = pgQuery.replace(/MAX\(0,/g, "GREATEST(0,");
  pgQuery = pgQuery.replace(/INSERT OR IGNORE/gi, "INSERT");
  return pgQuery;
}

export const db = {
  prepare: (query: string) => {
    const pgQuery = translateSqliteQuery(query);
    return {
      all: async (...args: any[]): Promise<any> =>
        await sql.query(pgQuery, args),
      get: async (...args: any[]): Promise<any> =>
        (await sql.query(pgQuery, args))[0],
      run: async (...args: any[]): Promise<any> => {
        await sql.query(pgQuery, args);
        return { changes: 1, lastInsertRowid: null };
      },
    };
  },
  exec: async (schema: string) => {
    // SQLite → Postgres DDL translations
    let pg = schema;
    pg = pg.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY");
    pg = pg.replace(/TEXT DEFAULT \(datetime\('now'\)\)/g, "TIMESTAMP DEFAULT NOW()");
    pg = pg.replace(/INSERT OR IGNORE/gi, "INSERT");
    pg = pg.replace(/MAX\(0,/g, "GREATEST(0,");
    // Neon doesn't support multi-statement exec in a single call. Split by semicolons.
    const statements = pg
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const stmt of statements) {
      try {
        await sql.query(stmt);
      } catch (e: any) {
        // Silently skip "already exists" errors during schema bootstrap
        if (!e.message?.includes("already exists") && !e.message?.includes("duplicate key")) {
          console.error(`Schema exec error: ${e.message}\nStatement: ${stmt.slice(0, 120)}`);
        }
      }
    }
  },
  transaction: (fn: any) => async (...args: any[]) => {
    // Neon serverless doesn't support BEGIN/COMMIT in HTTP mode.
    // Execute the function directly — individual queries are still atomic.
    return await fn(...args);
  },
};

// ── Schema bootstrap ──────────────────────────────────────────────────────────
async function bootstrap() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS auth_accounts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('CUSTOMER','ARTISAN','ADMIN')),
      suspended INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      auth_account_id TEXT UNIQUE NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS artisans (
      id TEXT PRIMARY KEY,
      auth_account_id TEXT UNIQUE NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
      studio_name TEXT NOT NULL,
      story TEXT DEFAULT '',
      approved INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      ai_story TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id TEXT PRIMARY KEY,
      auth_account_id TEXT UNIQUE NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      clearance TEXT DEFAULT 'ops'
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      auth_account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
      refresh_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      ip_address TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id),
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      price_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING_REVIEW',
      image_url TEXT DEFAULT '',
      featured INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      seo_keywords TEXT DEFAULT '',
      translations TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      reserved INTEGER DEFAULT 0,
      low_stock_at INTEGER DEFAULT 3,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      status TEXT DEFAULT 'PENDING',
      total_cents INTEGER NOT NULL,
      fraud_score REAL DEFAULT 0,
      fraud_reason TEXT DEFAULT '',
      coupon_code TEXT,
      discount_cents INTEGER DEFAULT 0,
      guest_email TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      price_cents INTEGER NOT NULL
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(customer_id, product_id)
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(customer_id, product_id)
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      auth_account_id TEXT REFERENCES auth_accounts(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      ip_address TEXT,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      auth_account_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_products_artisan ON products(artisan_id, status)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_account ON activity_logs(auth_account_id, created_at)`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS artisan_follows (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(customer_id, artisan_id)
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS product_embeddings (
      product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      vector TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_sessions(session_id, created_at)`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS browse_events (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_id TEXT,
      event_type TEXT NOT NULL,
      query TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_browse_events_customer ON browse_events(customer_id, created_at)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_browse_events_customer_type ON browse_events(customer_id, event_type)`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS artisan_payouts (
      id TEXT PRIMARY KEY,
      artisan_id TEXT NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      period TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_artisan_payouts_artisan ON artisan_payouts(artisan_id, status)`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      percent_off INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMP
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      line1 TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      postal TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_payment_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS shipping (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      carrier TEXT NOT NULL,
      tracking_number TEXT,
      status TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS product_media (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      alt TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Align older databases created before these columns/types existed.
  await db.exec(`
    ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE artisans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE sessions ALTER COLUMN expires_at TYPE TIMESTAMP USING expires_at::timestamp;
    ALTER TABLE notifications ALTER COLUMN read_at TYPE TIMESTAMP USING read_at::timestamp;
    ALTER TABLE coupons ALTER COLUMN expires_at TYPE TIMESTAMP USING expires_at::timestamp;
  `);

  // ── Seed defaults ─────────────────────────────────────────────────────────
  const settingsCount = (await db.prepare("SELECT COUNT(*) as c FROM site_settings").get()) as unknown as { c: number } | undefined;
  if (!settingsCount || Number(settingsCount.c) === 0) {
    const defaults = [
      ["maintenance_mode", "false"],
      ["registration_enabled", "true"],
      ["ai_features_enabled", "true"],
      ["guest_checkout_enabled", "true"],
      ["reviews_enabled", "true"],
      ["max_login_attempts", "10"],
    ];
    for (const [key, value] of defaults) {
      try {
        await db.prepare("INSERT INTO site_settings(key, value) VALUES($1, $2) ON CONFLICT DO NOTHING").run(key, value);
      } catch { /* ignore duplicate */ }
    }
  }

  const catCount = (await db.prepare("SELECT COUNT(*) as c FROM categories").get()) as unknown as { c: number } | undefined;
  if (!catCount || Number(catCount.c) === 0) {
    const cats = [
      ["cat_ceramics", "Ceramics", "ceramics"],
      ["cat_textiles", "Textiles", "textiles"],
      ["cat_woodwork", "Woodwork", "woodwork"],
      ["cat_metalwork", "Metalwork", "metalwork"],
      ["cat_lighting", "Lighting", "lighting"],
      ["cat_decor", "Decor", "decor"],
    ];
    for (const [id, name, slug] of cats) {
      try {
        await db.prepare("INSERT INTO categories(id,name,slug) VALUES($1,$2,$3) ON CONFLICT DO NOTHING").run(id, name, slug);
      } catch { /* ignore duplicate */ }
    }
  }

  await seedDemoData(db);
  console.log("✅ Neon database bootstrap complete.");
}

export const dbReady = bootstrap().catch((e) => {
  console.error("❌ Database bootstrap failed:", e);
  throw e;
});

export type AccountKind = "CUSTOMER" | "ARTISAN" | "ADMIN";
