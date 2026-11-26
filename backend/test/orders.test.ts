import { SELF, env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
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

describe('POST /api/orders', () => {
  it('accepts five orders from one IP and blocks the sixth with 429 and Retry-After 900', async () => {
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

  it('does not count rejected requests toward the limit', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      await postOrder({ ...orderBody(), total_paise: 1 }, ip);
    }
    const res = await postOrder(orderBody(), ip);
    expect(res.status).toBe(201);
  });
});
