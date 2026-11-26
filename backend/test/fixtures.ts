import { env } from 'cloudflare:test';

/** Fixed catalogue used by the public, order and image tests. Idempotent. */
export async function loadFixtures(): Promise<void> {
  const db = env.DB;
  const stmts = [
    "INSERT OR IGNORE INTO categories (id, name, slug, type, sort_order) VALUES (1, 'Sarees', 'sarees', 'product', 1)",
    "INSERT OR IGNORE INTO categories (id, name, slug, type, sort_order) VALUES (2, 'Hair', 'hair', 'service', 2)",
    "INSERT OR IGNORE INTO products (id, category_id, name, slug, description, tags, mrp_paise, price_paise, is_active) VALUES (1, 1, 'Silk Saree', 'silk-saree', 'Red silk', 'silk,saree', 150000, 120000, 1)",
    "INSERT OR IGNORE INTO products (id, category_id, name, slug, description, tags, mrp_paise, price_paise, is_active) VALUES (2, 1, 'Cotton Kurti', 'cotton-kurti', 'Navy cotton', 'cotton,kurti', 50000, 50000, 1)",
    "INSERT OR IGNORE INTO products (id, category_id, name, slug, description, tags, mrp_paise, price_paise, is_active) VALUES (3, 1, 'Hidden Top', 'hidden-top', '', 'top', 10000, 9900, 0)",
    "INSERT OR IGNORE INTO product_variants (id, product_id, size, colour, sku, stock) VALUES (1, 1, 'M', 'Red', 'SAREE-M-RED', 2)",
    "INSERT OR IGNORE INTO product_variants (id, product_id, size, colour, sku, stock) VALUES (2, 1, 'L', 'Red', 'SAREE-L-RED', 0)",
    "INSERT OR IGNORE INTO product_variants (id, product_id, size, colour, sku, stock) VALUES (3, 2, 'M', 'Navy', 'KURTI-M-NAVY', 0)",
    "INSERT OR IGNORE INTO product_variants (id, product_id, size, colour, sku, stock) VALUES (4, 3, 'S', 'Black', 'TOP-S-BLK', 5)",
    "INSERT OR IGNORE INTO product_images (id, product_id, r2_key, thumb_r2_key, alt_text, sort_order) VALUES (1, 1, 'products/1/11111111-1111-4111-8111-111111111111-full.webp', 'products/1/11111111-1111-4111-8111-111111111111-thumb.webp', 'Silk saree', 0)",
    "INSERT OR IGNORE INTO product_image_blobs (key, content_type, data) VALUES ('products/1/11111111-1111-4111-8111-111111111111-full.webp', 'image/webp', X'00')",
    "INSERT OR IGNORE INTO product_image_blobs (key, content_type, data) VALUES ('products/1/11111111-1111-4111-8111-111111111111-thumb.webp', 'image/webp', X'00')",
    "INSERT OR IGNORE INTO services (id, category_id, name, slug, description, price_paise, duration_minutes, is_active) VALUES (1, 2, 'Haircut', 'haircut', 'Cut and style', 40000, 30, 1)",
    "INSERT OR IGNORE INTO services (id, category_id, name, slug, description, price_paise, duration_minutes, is_active) VALUES (2, 2, 'Old Service', 'old-service', '', 100, 10, 0)",
    "INSERT INTO settings (key, value) VALUES ('business_name', 'Test Parlour') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    "INSERT INTO settings (key, value) VALUES ('whatsapp_number', '919999999999') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    "INSERT INTO settings (key, value) VALUES ('address', 'Test address') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    "INSERT INTO settings (key, value) VALUES ('opening_hours', 'Mon-Sat') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    "INSERT INTO settings (key, value) VALUES ('banner_text', 'Hello') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ];
  await db.batch(stmts.map((s) => db.prepare(s)));
}
