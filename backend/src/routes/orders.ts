import { Hono } from 'hono';
import {
  CreateOrderSchema,
  sumPaise,
  type OrderDto,
  type OrderItemDto,
} from '@beauty-store/shared';
import type { AppEnv } from '../env';
import { apiError, issueFields } from '../http/errors';
import { CACHE_NO_STORE } from '../http/cache';
import { checkRateLimit, hashIp, recordRateLimitHit } from '../http/rateLimit';
import { clientIp } from '../http/clientIp';

/** Validated POST /api/orders body (shape of CreateOrderSchema). */
export interface CreateOrderInput {
  customer_name: string;
  customer_phone: string;
  address: string;
  items: { product_id: number; variant_id: number; qty: number }[];
}

/** Raised for business-rule conflicts; mapped to 409 by the route. */
export class ConflictError extends Error {}

interface VariantPriceRow {
  variant_id: number;
  product_id: number;
  name: string;
  size: string;
  colour: string;
  stock: number;
  price_paise: number;
}

/**
 * Builds and stores an order. Prices come from D1 only; the client never supplies them.
 * Throws a ConflictError for unknown, inactive or over-stock variants.
 */
export async function createOrder(db: D1Database, input: CreateOrderInput): Promise<OrderDto> {
  const wanted = new Map<number, { product_id: number; qty: number }>();
  for (const item of input.items) {
    const existing = wanted.get(item.variant_id);
    if (existing && existing.product_id !== item.product_id) {
      throw new ConflictError('Variant does not belong to the given product');
    }
    wanted.set(item.variant_id, {
      product_id: item.product_id,
      qty: (existing?.qty ?? 0) + item.qty,
    });
  }

  const lookups = [...wanted.entries()].map(([variantId, { product_id }]) =>
    db
      .prepare(
        `SELECT v.id AS variant_id, v.product_id, p.name, v.size, v.colour, v.stock, p.price_paise
           FROM product_variants v JOIN products p ON p.id = v.product_id
          WHERE v.id = ? AND v.product_id = ? AND p.is_active = 1`,
      )
      .bind(variantId, product_id)
      .first<VariantPriceRow>(),
  );
  const rows = await Promise.all(lookups);

  const items: OrderItemDto[] = [];
  for (const row of rows) {
    if (row === null) throw new ConflictError('An item is unavailable');
    const qty = wanted.get(row.variant_id)?.qty ?? 0;
    if (qty > row.stock) throw new ConflictError(`Not enough stock for ${row.name}`);
    items.push({
      product_id: row.product_id,
      variant_id: row.variant_id,
      name: row.name,
      size: row.size,
      colour: row.colour,
      qty,
      unit_price_paise: row.price_paise,
    });
  }

  const total = sumPaise(items.map((i) => i.unit_price_paise * i.qty));
  const createdAt = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO orders (customer_name, customer_phone, address, items_json, total_paise, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'new', ?)`,
    )
    .bind(
      input.customer_name,
      input.customer_phone,
      input.address,
      JSON.stringify(items),
      total,
      createdAt,
    )
    .run();

  return {
    id: result.meta.last_row_id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    address: input.address,
    items,
    total_paise: total,
    status: 'new',
    created_at: createdAt,
  };
}

export const orderRoutes = new Hono<AppEnv>();

orderRoutes.post('/api/orders', async (c) => {
  const nowMs = Date.now();
  const ipHash = await hashIp(clientIp(c.req.raw));

  const limit = await checkRateLimit(c.env.DB, 'order', ipHash, nowMs);
  if (!limit.allowed) {
    c.header('Retry-After', String(limit.retryAfterSec));
    return apiError(c, 429, 'rate_limited', 'Too many orders. Try again later.');
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return apiError(c, 400, 'validation_failed', 'Request body must be JSON');
  }
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, 'validation_failed', 'Invalid order', issueFields(parsed.error.issues));
  }

  let order: OrderDto;
  try {
    order = await createOrder(c.env.DB, parsed.data);
  } catch (err) {
    if (err instanceof ConflictError) return apiError(c, 409, 'conflict', err.message);
    throw err;
  }

  await recordRateLimitHit(c.env.DB, 'order', ipHash, nowMs);
  c.header('Cache-Control', CACHE_NO_STORE);
  return c.json(
    {
      id: order.id,
      status: 'new' as const,
      total_paise: order.total_paise,
      items_count: order.items.reduce((sum, i) => sum + i.qty, 0),
    },
    201,
  );
});
