import { describe, expect, it, beforeAll } from 'vitest';
import app from '../../src/index';
import { adminFetch, ensureAdmin, login } from './helpers';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Every non-GET admin route, with path params filled in, except login (public by design). */
function mutatingAdminRoutes(): { method: string; path: string }[] {
  return app.routes
    .filter((r) => MUTATING.has(r.method) && r.path.startsWith('/api/admin/'))
    .filter((r) => r.path !== '/api/admin/login')
    .map((r) => ({
      method: r.method,
      path: r.path.replace(/:[A-Za-z]+/g, '1'),
    }));
}

describe('admin route gating', () => {
  beforeAll(async () => {
    await ensureAdmin();
  });

  it('enumerates the expected mutating admin routes', () => {
    const routes = mutatingAdminRoutes();
    expect(routes.length).toBeGreaterThanOrEqual(15);
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    expect(keys).toContain('POST /api/admin/logout');
    expect(keys).toContain('PUT /api/admin/settings');
    expect(keys).toContain('PATCH /api/admin/orders/1/status');
  });

  it('every mutating admin route returns 401 without a session', async () => {
    for (const { method, path } of mutatingAdminRoutes()) {
      const res = await adminFetch(null, method, path, {});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('every mutating admin route returns 403 csrf_failed with a session but no CSRF header', async () => {
    const session = await login();
    for (const { method, path } of mutatingAdminRoutes()) {
      const res = await adminFetch({ ...session, csrf: '' }, method, path, {});
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('csrf_failed');
    }
  });

  it('a CSRF header that differs from the cookie is rejected', async () => {
    const session = await login();
    const res = await adminFetch({ ...session, csrf: 'f'.repeat(64) }, 'POST', '/api/admin/logout');
    expect(res.status).toBe(403);
  });

  it('GET admin routes need a session but not CSRF', async () => {
    const session = await login();
    const res = await adminFetch({ ...session, csrf: '' }, 'GET', '/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
