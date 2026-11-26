import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './env';
import { apiError } from './http/errors';
import { publicRoutes } from './routes/public';
import { orderRoutes } from './routes/orders';
import { imageRoutes } from './routes/images';

const app = new Hono<AppEnv>();

app.get('/api/health', (c) => c.json({ ok: true }));

// Phase 4 adds app.route('/api/admin', adminRoutes) here.
app.route('/', publicRoutes);
app.route('/', orderRoutes);
app.route('/', imageRoutes);

app.notFound((c) => apiError(c, 404, 'not_found', 'Not found'));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (err.status === 429) return apiError(c, 429, 'rate_limited', err.message);
    if (err.status === 401) return apiError(c, 401, 'unauthorized', err.message);
    if (err.status === 403) return apiError(c, 403, 'csrf_failed', err.message);
    if (err.status === 404) return apiError(c, 404, 'not_found', err.message);
    if (err.status === 409) return apiError(c, 409, 'conflict', err.message);
    if (err.status < 500) return apiError(c, err.status, 'validation_failed', err.message);
  }
  console.error(err);
  return apiError(c, 500, 'internal', 'Internal server error');
});

export default app;
