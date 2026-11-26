import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const TABLES = [
  'categories',
  'products',
  'product_variants',
  'product_images',
  'services',
  'orders',
  'settings',
  'admin_users',
  'rate_limits',
  'bookings',
];

const INDEXES = [
  'idx_products_category_id',
  'idx_products_is_active',
  'idx_products_created_at',
  'idx_variants_product_id',
  'idx_images_product_sort',
  'idx_services_category_id',
  'idx_services_is_active',
  'idx_orders_status',
  'idx_orders_created_at',
  'idx_rate_limits_key_time',
  'idx_bookings_service_id',
  'idx_bookings_status',
];

describe('migration 0001_init', () => {
  it('creates every v1 table', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%'",
    ).all<{ name: string }>();
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual([...TABLES].sort());
  });

  it('creates every named index', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
    ).all<{ name: string }>();
    const names = new Set(results.map((r) => r.name));
    for (const index of INDEXES) expect(names.has(index), index).toBe(true);
  });
});
