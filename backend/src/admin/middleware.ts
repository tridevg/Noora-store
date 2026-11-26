import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import { CSRF_COOKIE, SESSION_COOKIE, readCookie } from '../auth/cookies';
import { constantTimeEqual } from '../auth/compare';
import { verifySession } from '../auth/session';
import { apiError } from '../http/errors';
import { CACHE_NO_STORE } from '../http/cache';

export type AdminEnv = { Bindings: Env; Variables: { admin: { sub: string } } };

/** Every admin response is no-store (applied after the handler, so errors are covered too). */
export const noStore: MiddlewareHandler<AdminEnv> = async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', CACHE_NO_STORE);
};

/** Requires a valid, unexpired bs_admin cookie. Sets c.var.admin.sub. */
export const requireSession: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const token = readCookie(c.req.raw, SESSION_COOKIE);
  const session =
    token === undefined
      ? null
      : await verifySession(token, c.env.SESSION_SECRET, Math.floor(Date.now() / 1000));
  if (session === null) return apiError(c, 401, 'unauthorized', 'Sign in required');
  c.set('admin', { sub: session.sub });
  await next();
};

/** Double-submit CSRF: X-CSRF-Token header must equal the bs_csrf cookie. */
export const requireCsrf: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const cookie = readCookie(c.req.raw, CSRF_COOKIE);
  const header = c.req.header('X-CSRF-Token');
  if (!cookie || !header || !constantTimeEqual(cookie, header)) {
    return apiError(c, 403, 'csrf_failed', 'Missing or invalid CSRF token');
  }
  await next();
};

/** Applies requireCsrf to every method except GET and HEAD. */
export const csrfForMutations: MiddlewareHandler<AdminEnv> = async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return next();
  return requireCsrf(c, next);
};
