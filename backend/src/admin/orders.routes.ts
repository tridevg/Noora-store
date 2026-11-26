import { Hono } from 'hono';
import {
  OrderListQuerySchema,
  OrderStatusUpdateSchema,
  type OrderStatus,
} from '@beauty-store/shared';
import { apiError } from '../http/errors';
import { ORDER_COLUMNS, parseId, parseJson, toOrderDto, type OrderRow } from './data';
import type { AdminEnv } from './middleware';

/** Legal order transitions (schema.md). delivered and cancelled are terminal. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const ordersRoutes = new Hono<AdminEnv>();

/** GET /api/admin/orders: optional status filter, newest first. */
ordersRoutes.get('/orders', async (c) => {
  const parsed = OrderListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return apiError(c, 400, 'validation_failed', 'Invalid query parameters');
  const { status, page, per_page: perPage } = parsed.data;
  const where = status === undefined ? '1 = 1' : 'status = ?';
  const binds: string[] = status === undefined ? [] : [status];
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM orders WHERE ${where}`)
    .bind(...binds)
    .first<{ total: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...binds, perPage, (page - 1) * perPage)
    .all<OrderRow>();
  return c.json({
    items: rows.results.map(toOrderDto),
    page,
    per_page: perPage,
    total: countRow?.total ?? 0,
  });
});

/**
 * PATCH /api/admin/orders/:id/status: session + CSRF. 409 on illegal transition.
 * The UPDATE is compare-and-set on the current status, so a concurrent change yields 409 too.
 */
ordersRoutes.patch('/orders/:id/status', async (c) => {
  const id = parseId(c.req.param('id'));
  const current =
    id === null
      ? null
      : await c.env.DB.prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`)
          .bind(id)
          .first<OrderRow>();
  if (id === null || current === null) return apiError(c, 404, 'not_found', 'Order not found');

  const parsed = await parseJson(c, (v) => OrderStatusUpdateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const target = parsed.data.status;

  if (!ORDER_TRANSITIONS[current.status].includes(target)) {
    return apiError(c, 409, 'conflict', `Cannot move order from ${current.status} to ${target}`);
  }
  const result = await c.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ? AND status = ?')
    .bind(target, id, current.status)
    .run();
  if (result.meta.changes === 0) {
    return apiError(c, 409, 'conflict', 'Order status changed; reload and try again');
  }
  const updated = await c.env.DB.prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`)
    .bind(id)
    .first<OrderRow>();
  return c.json({ order: toOrderDto(updated!) });
});
