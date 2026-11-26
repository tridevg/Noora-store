import { SELF, env } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadFixtures } from './fixtures';

const URL_ORDERS = 'http://localhost/api/orders';
let ipCounter = 0;

/** Each test gets its own client IP so rate-limit state does not leak between tests. */
function nextIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

function orderBody(overrides: Record<string, unknown> = {}, qty = 1) {
  return {
    customer_name: 'Asha Rao',
    customer_phone: '+91 98765 43210',
    address: '12 MG Road, Bengaluru',
    items: [{ product_id: 1, variant_id: 1, qty }],
    ...overrides,
  };
}

async function postOrder(body: unknown, ip: string): Promise<Response> {
  return SELF.fetch(URL_ORDERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await loadFixtures();
});

async function stockOf(variantId: number): Promise<number> {
  const row = await env.DB.prepare('SELECT stock FROM product_variants WHERE id = ?')
    .bind(variantId)
    .first<{ stock: number }>();
  return row?.stock ?? -1;
}

async function countOrders(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>();
  return row?.n ?? 0;
}

describe('POST /api/orders', () => {
  // Stock decrements persist across tests in this file, so restore the fixture levels first.
  beforeEach(async () => {
    await env.DB.prepare(
      'UPDATE product_variants SET stock = CASE id WHEN 1 THEN 2 WHEN 2 THEN 0 WHEN 3 THEN 0 WHEN 4 THEN 5 END',
    ).run();
  });

  it('accepts five orders from one IP and blocks the sixth with 429 and Retry-After 900', async () => {
    // Five single-unit orders need more than the fixture's 2 units. Storage is reset per test.
    await env.DB.prepare('UPDATE product_variants SET stock = 10 WHERE id = 1').run();
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      const res = await postOrder(orderBody(), ip);
      expect(res.status, `order ${i + 1}`).toBe(201);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
    const blocked = await postOrder(orderBody(), ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('900');
    const body = (await blocked.json()) as { error: { code: string } };
    expect(body.error.code).toBe('rate_limited');
  });

  it('returns 201 with id, status new, total and items_count', async () => {
    const res = await postOrder(orderBody({}, 2), nextIp());
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: number;
      status: string;
      total_paise: number;
      items_count: number;
    };
    expect(body.id).toBeGreaterThan(0);
    expect(body.status).toBe('new');
    expect(body.total_paise).toBe(240000);
    expect(body.items_count).toBe(2);
  });

  it('recomputes the total from D1 prices and stores the server price', async () => {
    const res = await postOrder(
      orderBody({ items: [{ product_id: 1, variant_id: 1, qty: 2 }] }),
      nextIp(),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; total_paise: number };
    expect(body.total_paise).toBe(120000 * 2);
    const row = await env.DB.prepare('SELECT total_paise, items_json FROM orders WHERE id = ?')
      .bind(body.id)
      .first<{ total_paise: number; items_json: string }>();
    expect(row?.total_paise).toBe(body.total_paise);
    const items = JSON.parse(row?.items_json ?? '[]') as {
      unit_price_paise: number;
      qty: number;
    }[];
    expect(items.map((i) => i.unit_price_paise)).toEqual([120000]);
  });

  it('rejects a tampered total_paise with 400', async () => {
    const res = await postOrder({ ...orderBody(), total_paise: 1 }, nextIp());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_failed');
  });

  it('rejects a tampered unit price inside items with 400', async () => {
    const res = await postOrder(
      orderBody({ items: [{ product_id: 1, variant_id: 1, qty: 1, unit_price_paise: 1 }] }),
      nextIp(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 conflict for an inactive product', async () => {
    const res = await postOrder(
      orderBody({ items: [{ product_id: 3, variant_id: 4, qty: 1 }] }),
      nextIp(),
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('conflict');
  });

  it('returns 409 conflict when qty is above stock', async () => {
    const res = await postOrder(orderBody({}, 3), nextIp());
    expect(res.status).toBe(409);
  });

  it('returns 409 listing every short line and writes nothing when stock is short', async () => {
    const ordersBefore = await countOrders();
    await env.DB.prepare('UPDATE product_variants SET stock = 0 WHERE id = 2').run();
    const short = await postOrder(
      orderBody({
        items: [
          { product_id: 1, variant_id: 1, qty: 3 },
          { product_id: 1, variant_id: 2, qty: 1 },
        ],
      }),
      nextIp(),
    );
    expect(short.status).toBe(409);
    const body = (await short.json()) as {
      error: { code: string; fields?: Record<string, string> };
    };
    expect(body.error.code).toBe('conflict');
    expect(body.error.fields).toEqual({
      variant_1: 'requested 3, available 2',
      variant_2: 'requested 1, available 0',
    });
    expect(await countOrders()).toBe(ordersBefore);
    expect(await stockOf(1)).toBe(2);
    expect(await stockOf(2)).toBe(0);
  });

  it('decrements stock in the same write as the order insert', async () => {
    const res = await postOrder(orderBody({}, 2), nextIp());
    expect(res.status).toBe(201);
    expect(await stockOf(1)).toBe(0);
    const again = await postOrder(orderBody({}, 1), nextIp());
    expect(again.status).toBe(409);
  });

  it('lets only one of two orders for the last unit succeed', async () => {
    await env.DB.prepare('UPDATE product_variants SET stock = 1 WHERE id = 1').run();
    const first = await postOrder(orderBody({}, 1), nextIp());
    expect(first.status).toBe(201);
    const second = await postOrder(orderBody({}, 1), nextIp());
    expect(second.status).toBe(409);
    expect(await stockOf(1)).toBe(0);
  });

  it('does not count rejected requests toward the limit', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      await postOrder({ ...orderBody(), total_paise: 1 }, ip);
    }
    const res = await postOrder(orderBody(), ip);
    expect(res.status).toBe(201);
  });
});
