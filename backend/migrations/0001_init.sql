CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('product', 'service')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',                       -- comma-separated, lowercase
  mrp_paise INTEGER NOT NULL CHECK (mrp_paise >= 0),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0 AND price_paise <= mrp_paise),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_created_at ON products(created_at);

CREATE TABLE product_variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  colour TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (product_id, size, colour)
);
CREATE INDEX idx_variants_product_id ON product_variants(product_id);

CREATE TABLE product_images (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,                         -- full image (WebP, or JPEG fallback), e.g. products/12/<uuid>-full.webp or ...-full.jpg
  thumb_r2_key TEXT NOT NULL,                          -- same format as r2_key, e.g. products/12/<uuid>-thumb.webp
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_images_product_sort ON product_images(product_id, sort_order);

CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_is_active ON services(is_active);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'delivered', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY CHECK (key IN ('business_name', 'whatsapp_number', 'address', 'opening_hours', 'banner_text')),
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL                          -- pbkdf2-sha256$100000$<saltB64>$<hashB64>
);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,                                   -- 'login:<ip_hash>' or 'order:<ip_hash>'; ip_hash = hex SHA-256 of client IP
  attempted_at INTEGER NOT NULL                        -- epoch milliseconds (UTC)
);
CREATE INDEX idx_rate_limits_key_time ON rate_limits(key, attempted_at);

CREATE TABLE bookings (                                -- schema only in v1; no routes
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled'))
);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
