import { SELF, env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureAdmin, adminFetch, login, BASE } from './helpers';
import { loadFixtures } from '../fixtures';
import { publicCacheUrls } from '../../src/cache/purge';

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

async function insertOrder(status: string): Promise<number> {
  const result = await env.DB.prepare(
    `INSERT INTO orders (customer_name, customer_phone, address, items_json, total_paise, status)
     VALUES ('Test', '+919999900000', 'Somewhere', '[]', 0, ?)`,
  )
    .bind(status)
    .run();
  return result.meta.last_row_id;
}

beforeAll(async () => {
  await ensureAdmin();
  await loadFixtures();
});

describe('order status flow', () => {
  it('new -> confirmed -> delivered is accepted', async () => {
    const id = await insertOrder('new');
    const c = await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'confirmed' });
    expect(c.status).toBe(200);
    expect(c.json.order.status).toBe('confirmed');
    const d = await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'delivered' });
    expect(d.status).toBe(200);
    expect(d.json.order.status).toBe('delivered');
  });

  it('new -> cancelled is accepted, and cancelled is terminal', async () => {
    const id = await insertOrder('new');
    expect(
      (await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'cancelled' })).status,
    ).toBe(200);
    const back = await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'confirmed' });
    expect(back.status).toBe(409);
  });

  it('illegal transitions return 409: new -> delivered, same-state, and out of delivered', async () => {
    const id = await insertOrder('new');
    expect(
      (await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'delivered' })).status,
    ).toBe(409);
    expect((await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'new' })).status).toBe(
      409,
    );
    const done = await insertOrder('delivered');
    expect(
      (await call('PATCH', `/api/admin/orders/${done}/status`, { status: 'cancelled' })).status,
    ).toBe(409);
  });

  it('unknown order is 404 and an invalid status value is 400', async () => {
    expect(
      (await call('PATCH', '/api/admin/orders/999999/status', { status: 'confirmed' })).status,
    ).toBe(404);
    const id = await insertOrder('new');
    expect(
      (await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'shipped' })).status,
    ).toBe(400);
  });

  it('lists orders with a status filter and reports dashboard counts', async () => {
    const id = await insertOrder('new');
    const list = await call('GET', '/api/admin/orders?status=new&per_page=48');
    expect(list.status).toBe(200);
    expect((list.json.items as Json[]).every((o) => o.status === 'new')).toBe(true);
    expect((list.json.items as Json[]).some((o) => o.id === id)).toBe(true);

    const dash = await call('GET', '/api/admin/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.json.counts.new).toBeGreaterThan(0);
    expect(dash.json.recent_orders.length).toBeLessThanOrEqual(10);
  });
});

describe('cache purge after admin mutations', () => {
  const origin = BASE;

  async function seedPublicCache(): Promise<void> {
    for (const url of publicCacheUrls(origin, ['silk-saree'])) {
      await caches.default.put(
        new Request(url),
        new Response('cached', { headers: { 'Cache-Control': 'public, max-age=300' } }),
      );
    }
  }

  async function isCached(url: string): Promise<boolean> {
    return (await caches.default.match(new Request(url))) !== undefined;
  }

  it('lists the canonical keys: four list paths plus one per product slug', () => {
    const urls = publicCacheUrls(origin, ['silk-saree', 'silk-saree', 'banarasi']);
    expect(urls).toEqual([
      `${origin}/api/categories`,
      `${origin}/api/products`,
      `${origin}/api/services`,
      `${origin}/api/settings`,
      `${origin}/api/products/silk-saree`,
      `${origin}/api/products/banarasi`,
    ]);
  });

  it('a settings update purges the settings and list keys', async () => {
    await seedPublicCache();
    expect(await isCached(`${origin}/api/settings`)).toBe(true);
    const res = await call('PUT', '/api/admin/settings', { address: 'New address' });
    expect(res.status).toBe(200);
    expect(await isCached(`${origin}/api/settings`)).toBe(false);
    expect(await isCached(`${origin}/api/products`)).toBe(false);
    // Settings touch no product, so product detail keys are left alone.
    expect(await isCached(`${origin}/api/products/silk-saree`)).toBe(true);
  });

  it('a product update purges both the old and the new slug', async () => {
    await caches.default.put(
      new Request(`${origin}/api/products/cotton-kurti`),
      new Response('old', { headers: { 'Cache-Control': 'public, max-age=300' } }),
    );
    await caches.default.put(
      new Request(`${origin}/api/products/renamed-kurti`),
      new Response('new', { headers: { 'Cache-Control': 'public, max-age=300' } }),
    );
    const res = await call('PUT', '/api/admin/products/2', { slug: 'renamed-kurti' });
    expect(res.status).toBe(200);
    expect(await isCached(`${origin}/api/products/cotton-kurti`)).toBe(false);
    expect(await isCached(`${origin}/api/products/renamed-kurti`)).toBe(false);
  });

  it('a failed mutation does not purge', async () => {
    await seedPublicCache();
    const res = await call('PUT', '/api/admin/services/999999', { name: 'nope' });
    expect(res.status).toBe(404);
    expect(await isCached(`${origin}/api/services`)).toBe(true);
    expect(await isCached(`${origin}/api/products/silk-saree`)).toBe(true);
  });

  it('a 409 slug conflict does not purge either', async () => {
    await seedPublicCache();
    const res = await call('POST', '/api/admin/services', {
      category_id: 2,
      name: 'Haircut dup',
      slug: 'haircut',
      price_paise: 1,
      duration_minutes: 10,
    });
    expect(res.status).toBe(409);
    expect(await isCached(`${origin}/api/services`)).toBe(true);
  });

  it('order status changes do not purge the public cache', async () => {
    await seedPublicCache();
    const id = await insertOrder('new');
    await call('PATCH', `/api/admin/orders/${id}/status`, { status: 'confirmed' });
    expect(await isCached(`${origin}/api/products`)).toBe(true);
  });

  it('a GET does not purge', async () => {
    await seedPublicCache();
    const session = await login();
    await SELF.fetch(`${BASE}/api/admin/products`, { headers: { Cookie: session.cookie } });
    expect(await isCached(`${origin}/api/products`)).toBe(true);
  });
});
