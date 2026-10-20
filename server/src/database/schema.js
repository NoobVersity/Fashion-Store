/**
 * Repeatable schema initialization.
 * Every statement is idempotent, so this can run safely on any open
 * database (fresh file or already-seeded demo database).
 *
 * Monetary values are stored as INTEGER minor units (cents) to avoid
 * floating point rounding errors. Currency is configured in
 * store_settings (default: USD).
 */
export function createSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,            -- HMAC of the session token
      admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      price       INTEGER NOT NULL CHECK (price >= 0),   -- cents
      image_path  TEXT NOT NULL DEFAULT '',
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

    CREATE TABLE IF NOT EXISTS product_variants (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size           TEXT NOT NULL,
      color          TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      UNIQUE (product_id, size, color)
    );
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

    -- Guest checkout upserts one row per unique email so the admin area
    -- can list unique customers and their order history.
    CREATE TABLE IF NOT EXISTS customers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone         TEXT NOT NULL DEFAULT '',
      password_hash TEXT,                          -- NULL = guest, no account
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS customer_sessions (
      id          TEXT PRIMARY KEY,                -- HMAC of the session token
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
      ON customer_sessions(customer_id);

    CREATE TABLE IF NOT EXISTS discounts (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      code                 TEXT NOT NULL UNIQUE COLLATE NOCASE,
      discount_type        TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
      discount_value       INTEGER NOT NULL CHECK (discount_value > 0), -- percent (1-100) or cents
      minimum_order_value  INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_value >= 0),
      starts_at            TEXT,
      expires_at           TEXT,
      usage_limit          INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
      usage_count          INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
      is_active            INTEGER NOT NULL DEFAULT 1,
      description          TEXT NOT NULL DEFAULT '',
      created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number     TEXT NOT NULL UNIQUE,
      checkout_token   TEXT UNIQUE,             -- prevents duplicate submissions
      customer_id      INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name    TEXT NOT NULL,
      customer_email   TEXT NOT NULL,
      customer_phone   TEXT NOT NULL DEFAULT '',
      shipping_address TEXT NOT NULL,
      order_note       TEXT NOT NULL DEFAULT '',
      subtotal         INTEGER NOT NULL CHECK (subtotal >= 0),
      discount_amount  INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      discount_code    TEXT,
      total            INTEGER NOT NULL CHECK (total >= 0),
      order_status     TEXT NOT NULL DEFAULT 'pending'
                         CHECK (order_status IN ('pending','processing','shipped','delivered','cancelled')),
      payment_method   TEXT NOT NULL DEFAULT 'simulated',
      payment_status   TEXT NOT NULL DEFAULT 'simulated',
      stock_restored   INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

    CREATE TABLE IF NOT EXISTS order_items (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id             INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id           INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name_snapshot TEXT NOT NULL,
      variant_snapshot     TEXT NOT NULL,       -- e.g. "M / Black"
      unit_price           INTEGER NOT NULL CHECK (unit_price >= 0),
      quantity             INTEGER NOT NULL CHECK (quantity > 0),
      line_total           INTEGER NOT NULL CHECK (line_total >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS store_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // One-time upgrade for databases created before customer accounts
  // existed (CREATE TABLE IF NOT EXISTS never adds new columns).
  const customerCols = db.pragma('table_info(customers)');
  if (!customerCols.some((c) => c.name === 'password_hash')) {
    db.exec('ALTER TABLE customers ADD COLUMN password_hash TEXT');
  }
}
