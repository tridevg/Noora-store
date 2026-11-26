import { Hono } from 'hono';
import { LoginSchema } from '@beauty-store/shared';
import { buildAuthCookies, clearAuthCookies, SESSION_MAX_AGE_SEC } from '../auth/cookies';
import { hashPassword, verifyPassword } from '../auth/pbkdf2';
import { signSession } from '../auth/session';
import { apiError } from '../http/errors';
import { checkRateLimit, clearRateLimit, hashIp, recordRateLimitHit } from '../http/rateLimit';
import { clientIp } from '../http/clientIp';
import { parseJson } from './data';
import type { AdminEnv } from './middleware';

/**
 * Verified against when the username is unknown, so both failure paths spend the same PBKDF2 time.
 * The value is a valid hash of a random string and never matches a real password.
 */
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('no-such-user-' + crypto.randomUUID());
  return dummyHashPromise;
}

function randomCsrfToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** POST /api/admin/login: public, rate-limited. Mounted before the session gate. */
export const loginRoutes = new Hono<AdminEnv>();

loginRoutes.post('/login', async (c) => {
  const nowMs = Date.now();
  const ipHash = await hashIp(clientIp(c.req.raw));

  const limit = await checkRateLimit(c.env.DB, 'login', ipHash, nowMs);
  if (!limit.allowed) {
    c.header('Retry-After', String(limit.retryAfterSec));
    return apiError(c, 429, 'rate_limited', 'Too many failed logins. Try again later.');
  }

  const parsed = await parseJson(c, (v) => LoginSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const { username, password } = parsed.data;

  const admin = await c.env.DB.prepare(
    'SELECT username, password_hash FROM admin_users WHERE username = ?',
  )
    .bind(username)
    .first<{ username: string; password_hash: string }>();
  const passwordOk = await verifyPassword(password, admin?.password_hash ?? (await dummyHash()));

  if (admin === null || !passwordOk) {
    await recordRateLimitHit(c.env.DB, 'login', ipHash, nowMs);
    return apiError(c, 401, 'unauthorized', 'Invalid username or password');
  }

  await clearRateLimit(c.env.DB, 'login', ipHash);
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SEC;
  const sessionToken = await signSession({ sub: admin.username, exp }, c.env.SESSION_SECRET);
  for (const cookie of buildAuthCookies(c.req.raw, sessionToken, randomCsrfToken())) {
    c.header('Set-Cookie', cookie, { append: true });
  }
  return c.json({ username: admin.username }, 200);
});

/** Session-gated routes: logout and session check. */
export const sessionRoutes = new Hono<AdminEnv>();

/** POST /api/admin/logout: session + CSRF. Clears both cookies. */
sessionRoutes.post('/logout', (c) => {
  for (const cookie of clearAuthCookies(c.req.raw)) {
    c.header('Set-Cookie', cookie, { append: true });
  }
  return c.body(null, 204);
});

/** GET /api/admin/session: session only. */
sessionRoutes.get('/session', (c) => c.json({ username: c.var.admin.sub }));
