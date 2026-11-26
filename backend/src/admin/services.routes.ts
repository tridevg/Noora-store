import { Hono } from 'hono';
import { ServiceCreateSchema, ServiceUpdateSchema } from '@beauty-store/shared';
import { apiError } from '../http/errors';
import { purgePublicCache } from '../cache/purge';
import { clientOrigin } from './origin';
import { dbWriteError, parseId, parseJson } from './data';
import type { AdminEnv } from './middleware';
import { SERVICE_SELECT, categoryExists, toServiceDto, type ServiceRow } from './queries';

async function loadService(db: D1Database, id: number): Promise<ServiceRow | null> {
  return db.prepare(`${SERVICE_SELECT} WHERE s.id = ?`).bind(id).first<ServiceRow>();
}

export const servicesRoutes = new Hono<AdminEnv>();

/** POST /api/admin/services: session + CSRF. Purges public cache. */
/** GET /api/admin/services: all services, including inactive ones. */
servicesRoutes.get('/services', async (c) => {
  const result = await c.env.DB.prepare(
    `${SERVICE_SELECT} ORDER BY c.sort_order, c.id, s.id`,
  ).all<ServiceRow>();
  return c.json({ services: result.results.map(toServiceDto) });
});

/** GET /api/admin/services/:id: includes inactive services. */
servicesRoutes.get('/services/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const row = id === null ? null : await loadService(c.env.DB, id);
  if (id === null || row === null) return apiError(c, 404, 'not_found', 'Service not found');
  return c.json({ service: toServiceDto(row) });
});

/** POST /api/admin/services: session + CSRF. Purges public cache. */
servicesRoutes.post('/services', async (c) => {
  const parsed = await parseJson(c, (v) => ServiceCreateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;
  if (!(await categoryExists(c.env.DB, data.category_id))) {
    return apiError(c, 400, 'validation_failed', 'Invalid request', {
      category_id: 'Unknown category',
    });
  }

  let id: number;
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO services (category_id, name, slug, description, price_paise, duration_minutes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        data.category_id,
        data.name,
        data.slug,
        data.description,
        data.price_paise,
        data.duration_minutes,
        data.is_active ? 1 : 0,
      )
      .run();
    id = result.meta.last_row_id;
  } catch (err) {
    return dbWriteError(c, err, 'insert');
  }
  const row = await loadService(c.env.DB, id);
  await purgePublicCache(clientOrigin(c.req.raw), []);
  return c.json({ service: toServiceDto(row!) }, 201);
});

/** PUT /api/admin/services/:id: partial. */
servicesRoutes.put('/services/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id === null ? null : await loadService(c.env.DB, id);
  if (id === null || existing === null) return apiError(c, 404, 'not_found', 'Service not found');

  const parsed = await parseJson(c, (v) => ServiceUpdateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;
  if (data.category_id !== undefined && !(await categoryExists(c.env.DB, data.category_id))) {
    return apiError(c, 400, 'validation_failed', 'Invalid request', {
      category_id: 'Unknown category',
    });
  }

  const sets: string[] = [];
  const binds: (string | number)[] = [];
  const entries: [string, string | number | undefined][] = [
    ['category_id', data.category_id],
    ['name', data.name],
    ['slug', data.slug],
    ['description', data.description],
    ['price_paise', data.price_paise],
    ['duration_minutes', data.duration_minutes],
    ['is_active', data.is_active === undefined ? undefined : data.is_active ? 1 : 0],
  ];
  for (const [column, value] of entries) {
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      binds.push(value);
    }
  }
  if (sets.length > 0) {
    try {
      await c.env.DB.prepare(`UPDATE services SET ${sets.join(', ')} WHERE id = ?`)
        .bind(...binds, id)
        .run();
    } catch (err) {
      return dbWriteError(c, err, 'insert');
    }
  }
  const row = await loadService(c.env.DB, id);
  await purgePublicCache(clientOrigin(c.req.raw), []);
  return c.json({ service: toServiceDto(row!) });
});

/** DELETE /api/admin/services/:id: 409 while bookings reference the service. */
servicesRoutes.delete('/services/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null || (await loadService(c.env.DB, id)) === null) {
    return apiError(c, 404, 'not_found', 'Service not found');
  }
  try {
    await c.env.DB.prepare('DELETE FROM services WHERE id = ?').bind(id).run();
  } catch (err) {
    return dbWriteError(c, err, 'delete');
  }
  await purgePublicCache(clientOrigin(c.req.raw), []);
  return c.body(null, 204);
});
