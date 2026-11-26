import { SELF, env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureAdmin, adminFetch, login } from './helpers';
import { loadFixtures } from '../fixtures';

// Response bodies are loosely typed in these integration tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Json }> {
  const session = await login();
  const res = await adminFetch(session, method, path, body);
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as Json) : {} };
}

beforeAll(async () => {
  await ensureAdmin();
  await loadFixtures();
});

describe('products CRUD', () => {
  it('lists products including inactive ones, with variants and images', async () => {
    const { status, json } = await call('GET', '/api/admin/products?per_page=48');
    expect(status).toBe(200);
    const slugs = (json.items as Json[]).map((p) => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(['silk-saree', 'hidden-top']));
    const saree = (json.items as Json[]).find((p) => p.slug === 'silk-saree');
    expect(saree.variants).toHaveLength(2);
    expect(saree.images).toHaveLength(1);
    expect(saree.in_stock).toBe(true);
    expect(saree.percent_off).toBe(20);
  });

  it('creates a product and rejects a duplicate slug with 409', async () => {
    const body = {
      category_id: 1,
      name: 'Banarasi Saree',
      slug: 'banarasi-saree',
      description: 'Zari work',
      tags: 'Silk,Wedding',
      mrp_paise: 200000,
      price_paise: 180000,
    };
    const created = await call('POST', '/api/admin/products', body);
    expect(created.status).toBe(201);
    expect(created.json.product.tags).toBe('silk,wedding');
    expect(created.json.product.is_active).toBe(true);

    const dup = await call('POST', '/api/admin/products', body);
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe('conflict');
  });

  it('rejects float paise and price above MRP with 400', async () => {
    const floats = await call('POST', '/api/admin/products', {
      category_id: 1,
      name: 'Float',
      slug: 'float-item',
      mrp_paise: 100.5,
      price_paise: 90,
    });
    expect(floats.status).toBe(400);
    const above = await call('POST', '/api/admin/products', {
      category_id: 1,
      name: 'Above',
      slug: 'above-item',
      mrp_paise: 100,
      price_paise: 200,
    });
    expect(above.status).toBe(400);
  });

  it('updates a product partially and rejects price above the stored MRP', async () => {
    const ok = await call('PUT', '/api/admin/products/2', { name: 'Cotton Kurti Long' });
    expect(ok.status).toBe(200);
    expect(ok.json.product.name).toBe('Cotton Kurti Long');
    const bad = await call('PUT', '/api/admin/products/2', { price_paise: 999999 });
    expect(bad.status).toBe(400);
  });

  it('returns 404 for an unknown product id and 409 when renaming onto an existing slug', async () => {
    expect((await call('PUT', '/api/admin/products/99999', { name: 'x' })).status).toBe(404);
    const clash = await call('PUT', '/api/admin/products/2', { slug: 'silk-saree' });
    expect(clash.status).toBe(409);
  });

  it('rejects an unknown category with 400', async () => {
    const res = await call('POST', '/api/admin/products', {
      category_id: 999,
      name: 'Orphan',
      slug: 'orphan-item',
      mrp_paise: 100,
      price_paise: 100,
    });
    expect(res.status).toBe(400);
    expect(res.json.error.fields.category_id).toBeDefined();
  });

  it('deletes a product, removes its image blobs, and cascades variants', async () => {
    const key = 'products/3/44444444-4444-4444-8444-444444444444-full.webp';
    const thumb = 'products/3/44444444-4444-4444-8444-444444444444-thumb.webp';
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO product_image_blobs (key, content_type, data) VALUES (?, 'image/webp', X'01')",
      ).bind(key),
      env.DB.prepare(
        "INSERT INTO product_image_blobs (key, content_type, data) VALUES (?, 'image/webp', X'01')",
      ).bind(thumb),
      env.DB.prepare(
        'INSERT INTO product_images (product_id, r2_key, thumb_r2_key, alt_text, sort_order) VALUES (3, ?, ?, ?, 0)',
      ).bind(key, thumb, ''),
    ]);

    const res = await call('DELETE', '/api/admin/products/3');
    expect(res.status).toBe(204);
    const blobs = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM product_image_blobs WHERE key IN (?, ?)',
    )
      .bind(key, thumb)
      .first<{ n: number }>();
    expect(blobs?.n).toBe(0);
    const variants = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM product_variants WHERE product_id = 3',
    ).first<{ n: number }>();
    expect(variants?.n).toBe(0);
    expect((await call('DELETE', '/api/admin/products/3')).status).toBe(404);
  });
});

describe('variants CRUD', () => {
  it('adds a variant, rejects duplicate size+colour and sku with 409', async () => {
    const add = await call('POST', '/api/admin/products/2/variants', {
      size: 'S',
      colour: 'Navy',
      sku: 'KURTI-S-NAVY',
      stock: 4,
    });
    expect(add.status).toBe(201);
    expect(add.json.variant.stock).toBe(4);

    const sameSizeColour = await call('POST', '/api/admin/products/2/variants', {
      size: 'S',
      colour: 'Navy',
      sku: 'KURTI-S-NAVY-2',
    });
    expect(sameSizeColour.status).toBe(409);

    const sameSku = await call('POST', '/api/admin/products/2/variants', {
      size: 'XL',
      colour: 'Navy',
      sku: 'KURTI-S-NAVY',
    });
    expect(sameSku.status).toBe(409);
  });

  it('updates stock, deletes a variant, and returns 404 for unknown ids', async () => {
    const upd = await call('PUT', '/api/admin/variants/1', { stock: 7 });
    expect(upd.status).toBe(200);
    expect(upd.json.variant.stock).toBe(7);
    expect((await call('PUT', '/api/admin/variants/999999', { stock: 1 })).status).toBe(404);
    expect((await call('DELETE', '/api/admin/variants/999999')).status).toBe(404);
    const del = await call('DELETE', '/api/admin/variants/4');
    expect(del.status).toBe(204);
  });

  it('rejects negative stock with 400', async () => {
    expect((await call('PUT', '/api/admin/variants/1', { stock: -1 })).status).toBe(400);
  });
});

describe('services CRUD', () => {
  it('creates, updates and deletes a service', async () => {
    const created = await call('POST', '/api/admin/services', {
      category_id: 2,
      name: 'Facial',
      slug: 'facial',
      price_paise: 75000,
      duration_minutes: 45,
    });
    expect(created.status).toBe(201);
    expect(created.json.service.category.slug).toBe('hair');
    expect(created.json.service.is_active).toBe(true);

    const dup = await call('POST', '/api/admin/services', {
      category_id: 2,
      name: 'Facial again',
      slug: 'facial',
      price_paise: 1,
      duration_minutes: 1,
    });
    expect(dup.status).toBe(409);

    const id = created.json.service.id;
    const upd = await call('PUT', `/api/admin/services/${id}`, { is_active: false });
    expect(upd.status).toBe(200);
    expect(upd.json.service.is_active).toBe(false);

    expect((await call('DELETE', `/api/admin/services/${id}`)).status).toBe(204);
    expect((await call('PUT', `/api/admin/services/${id}`, { name: 'x' })).status).toBe(404);
  });

  it('refuses a service with a non-positive duration', async () => {
    const res = await call('POST', '/api/admin/services', {
      category_id: 2,
      name: 'Bad',
      slug: 'bad-duration',
      price_paise: 1,
      duration_minutes: 0,
    });
    expect(res.status).toBe(400);
  });
});

describe('settings', () => {
  it('updates known keys and returns the full map', async () => {
    const res = await call('PUT', '/api/admin/settings', { banner_text: 'Diwali sale' });
    expect(res.status).toBe(200);
    expect(res.json.settings.banner_text).toBe('Diwali sale');
    expect(res.json.settings.business_name).toBe('Test Parlour');
  });

  it('rejects unknown keys and an empty body with 400', async () => {
    expect((await call('PUT', '/api/admin/settings', { favourite_colour: 'red' })).status).toBe(
      400,
    );
    expect((await call('PUT', '/api/admin/settings', {})).status).toBe(400);
  });
});

describe('malformed input', () => {
  it('returns 400 for invalid JSON', async () => {
    const session = await login();
    const res = await SELF.fetch('http://localhost/api/admin/services', {
      method: 'POST',
      headers: {
        Cookie: session.cookie,
        'X-CSRF-Token': session.csrf,
        'Content-Type': 'application/json',
      },
      body: '{not json',
    });
    expect(res.status).toBe(400);
  });
});
