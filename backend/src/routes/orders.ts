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

/** One cart line that asks for more units than D1 holds. */
export interface StockShortage {
  variant_id: number;
  requested: number;
  available: number;
}

/** Raised when one or more lines exceed stock. Nothing is written. Mapped to 409 with per-line detail. */
export class StockConflictError extends ConflictError {
  constructor(readonly shortages: StockShortage[]) {
    super('Some items are out of stock');
  }
}

/** Error `fields` entries for a stock 409: key `variant_<id>`, value `requested <n>, available <m>`. */
export function stockFields(shortages: readonly StockShortage[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const s of shortages) {
    fields[`variant_${s.variant_id}`] = `requested ${s.requested}, available ${s.available}`;
  }
  return fields;
}

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
  const shortages: StockShortage[] = [];
  for (const row of rows) {
    if (row === null) throw new ConflictError('An item is unavailable');
    const qty = wanted.get(row.variant_id)?.qty ?? 0;
    if (qty > row.stock) {
      shortages.push({ variant_id: row.variant_id, requested: qty, available: row.stock });
    }
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
  if (shortages.length > 0) throw new StockConflictError(shortages);

  const total = sumPaise(items.map((i) => i.unit_price_paise * i.qty));
  const createdAt = new Date().toISOString();
  // One D1 batch = one transaction. Each decrement is guarded by the stock CHECK (stock >= 0),
  // so a line that lost a race fails the whole batch and rolls back the order insert too.
  const decrements = items.map((i) =>
    db
      .prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND product_id = ?')
      .bind(i.qty, i.variant_id, i.product_id),
  );
  const insert = db
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
    );

  let results: D1Result[];
  try {
    results = await db.batch([...decrements, insert]);
  } catch (err) {
    // Lost a race for the last unit(s): report which lines are short now, if any.
    const current = await lookupStock(db, items);
    const raced = items
      .filter((i) => i.qty > (current.get(i.variant_id) ?? 0))
      .map((i) => ({
        variant_id: i.variant_id,
        requested: i.qty,
        available: current.get(i.variant_id) ?? 0,
      }));
    if (raced.length > 0) throw new StockConflictError(raced);
    throw err;
  }

  return {
    id: results[results.length - 1]!.meta.last_row_id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    address: input.address,
    items,
    total_paise: total,
    status: 'new',
    created_at: createdAt,
  };
}

async function lookupStock(db: D1Database, items: OrderItemDto[]): Promise<Map<number, number>> {
  const rows = await db
    .prepare(
      `SELECT id, stock FROM product_variants WHERE id IN (${items.map(() => '?').join(', ')})`,
    )
    .bind(...items.map((i) => i.variant_id))
    .all<{ id: number; stock: number }>();
  return new Map(rows.results.map((r) => [r.id, r.stock]));
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
    if (err instanceof StockConflictError) {
      return apiError(c, 409, 'conflict', err.message, stockFields(err.shortages));
    }
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
