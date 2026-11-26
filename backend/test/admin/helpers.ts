import { SELF, env } from 'cloudflare:test';
import { hashPassword } from '../../src/auth/pbkdf2';

export const ADMIN_USER = 'admin';
export const ADMIN_PASSWORD = 'correct-horse-battery';
export const BASE = 'http://localhost';
/** Test-only count. 100000 is too slow for this suite; verify reads the count from the stored hash. */
export const TEST_PBKDF2_ITERATIONS = 1000;

let hashCache: Promise<string> | null = null;

/** Inserts the test admin once per suite (hashing costs 100k PBKDF2 iterations). */
export async function ensureAdmin(): Promise<void> {
  hashCache ??= hashPassword(ADMIN_PASSWORD, TEST_PBKDF2_ITERATIONS);
  const hash = await hashCache;
  await env.DB.prepare(
    'INSERT INTO admin_users (username, password_hash) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash',
  )
    .bind(ADMIN_USER, hash)
    .run();
}

let ipCounter = 0;
/** A fresh client IP so rate-limit state never leaks between tests. */
export function freshIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

export interface Session {
  cookie: string;
  csrf: string;
}

/** Logs in and returns a Cookie header value plus the matching CSRF token. */
export async function login(ip = freshIp(), password = ADMIN_PASSWORD): Promise<Session> {
  const res = await SELF.fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ username: ADMIN_USER, password }),
  });
  if (res.status !== 200) throw new Error(`login failed with ${res.status}`);
  return sessionFrom(res);
}

export function sessionFrom(res: Response): Session {
  const pairs = res.headers.getSetCookie().map((raw) => raw.split(';')[0]!);
  const admin = pairs.find((p) => p.startsWith('bs_admin='));
  const csrf = pairs.find((p) => p.startsWith('bs_csrf='));
  if (!admin || !csrf) throw new Error('missing auth cookies');
  return {
    cookie: `${admin}; ${csrf}`,
    csrf: csrf.slice('bs_csrf='.length),
  };
}

/** Authenticated admin request. Adds the CSRF header for non-GET methods. */
export async function adminFetch(
  session: Session | null,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (session) headers.Cookie = session.cookie;
  if (session && method !== 'GET') headers['X-CSRF-Token'] = session.csrf;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return SELF.fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
