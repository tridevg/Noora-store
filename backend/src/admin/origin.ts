import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import { apiError } from '../http/errors';
import type { AdminEnv } from './middleware';

/** Origin of the admin request; used to build canonical cache keys for purging. */
export function clientOrigin(request: Request): string {
  return new URL(request.url).origin;
}

/**
 * Pages origins allowed to send admin mutations. SITE_URL is always added on top of this list.
 * noora-2yi stays until the temporary project is deleted; noora-studio is the replacement.
 */
export const ADMIN_ORIGIN_ALLOWLIST: readonly string[] = [
  'https://noora-2yi.pages.dev',
  'https://noora-studio.pages.dev',
];

/** Allowed origins for this Worker: the named constant list plus SITE_URL when it is set. */
export function allowedAdminOrigins(env: Pick<Env, 'SITE_URL'>): Set<string> {
  const origins = new Set<string>(ADMIN_ORIGIN_ALLOWLIST);
  const configured = env.SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) origins.add(configured);
  return origins;
}

/**
 * Rejects admin mutations whose Origin header is not on the allowlist. A request with no Origin
 * header is passed on; the CSRF check still applies to it. GET and HEAD are never checked.
 */
export const originForMutations: MiddlewareHandler<AdminEnv> = async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return next();
  const origin = c.req.header('Origin');
  if (origin === undefined) return next();
  if (!allowedAdminOrigins(c.env).has(origin)) {
    return apiError(c, 403, 'csrf_failed', 'Origin not allowed');
  }
  await next();
};
