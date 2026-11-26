import { Hono } from 'hono';
import type { DashboardDto, OrderStatus } from '@beauty-store/shared';
import { ORDER_COLUMNS, toOrderDto, type OrderRow } from './data';
import type { AdminEnv } from './middleware';

export const dashboardRoutes = new Hono<AdminEnv>();

/** GET /api/admin/dashboard: order counts per status and the 10 most recent orders. */
dashboardRoutes.get('/dashboard', async (c) => {
  const counts: Record<OrderStatus, number> = { new: 0, confirmed: 0, delivered: 0, cancelled: 0 };
  const grouped = await c.env.DB.prepare(
    'SELECT status, COUNT(*) AS n FROM orders GROUP BY status',
  ).all<{
    status: OrderStatus;
    n: number;
  }>();
  for (const row of grouped.results) counts[row.status] = row.n;

  const recent = await c.env.DB.prepare(
    `SELECT ${ORDER_COLUMNS} FROM orders ORDER BY created_at DESC, id DESC LIMIT 10`,
  ).all<OrderRow>();
  const body: DashboardDto = { counts, recent_orders: recent.results.map(toOrderDto) };
  return c.json(body);
});
