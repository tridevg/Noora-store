import { SELF, env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword, PBKDF2_ITERATIONS, verifyPassword } from '../../src/auth/pbkdf2';
import { signSession, verifySession } from '../../src/auth/session';
import { buildAuthCookies, clearAuthCookies } from '../../src/auth/cookies';
import { hashIp } from '../../src/http/rateLimit';
import {
  ADMIN_PASSWORD,
  ADMIN_USER,
  BASE,
  TEST_PBKDF2_ITERATIONS,
  adminFetch,
  ensureAdmin,
  freshIp,
  login,
  sessionFrom,
} from './helpers';

const SECRET = 'test-only-session-secret';
const NOW = 1_800_000_000;

describe('PBKDF2 hashing', () => {
  it('uses 100000 iterations and the documented format', async () => {
    expect(PBKDF2_ITERATIONS).toBe(100_000);
    const stored = await hashPassword('test-pass');
    const parts = stored.split('$');
    expect(parts.slice(0, 2)).toEqual(['pbkdf2-sha256', '100000']);
    expect(parts).toHaveLength(4);
    expect(Buffer.from(parts[2]!, 'base64')).toHaveLength(16);
    expect(Buffer.from(parts[3]!, 'base64')).toHaveLength(32);
  });

  it('verifies the right password and rejects the wrong one', async () => {
    const stored = await hashPassword('test-pass', TEST_PBKDF2_ITERATIONS);
    expect(await verifyPassword('test-pass', stored)).toBe(true);
    expect(await verifyPassword('test-pasS', stored)).toBe(false);
  });

  it('returns false for malformed stored values without throwing', async () => {
    for (const bad of [
      '',
      'plain',
      'bcrypt$10$abc$def',
      'pbkdf2-sha256$abc$AAAA$AAAA',
      'pbkdf2-sha256$100000$!!!$AAAA',
      'pbkdf2-sha256$100000$AAAA',
      'pbkdf2-sha256$999999999$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    ]) {
      expect(await verifyPassword('x', bad), bad).toBe(false);
    }
  });
});

describe('session tokens', () => {
  it('round-trips a valid token', async () => {
    const token = await signSession({ sub: ADMIN_USER, exp: NOW + 60 }, SECRET);
    expect(await verifySession(token, SECRET, NOW)).toEqual({ sub: ADMIN_USER, exp: NOW + 60 });
  });

  it('rejects a tampered payload, a wrong secret, and an expired token', async () => {
    const token = await signSession({ sub: ADMIN_USER, exp: NOW + 60 }, SECRET);
    const [payload, sig] = token.split('.') as [string, string];
    const forged = Buffer.from(JSON.stringify({ sub: 'root', exp: NOW + 60 })).toString(
      'base64url',
    );
    expect(await verifySession(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
    expect(await verifySession(token, 'other-secret', NOW)).toBeNull();
    expect(await verifySession(`${payload}.${sig.slice(0, -2)}AA`, SECRET, NOW)).toBeNull();
    expect(await verifySession(token, SECRET, NOW + 61)).toBeNull();
    expect(await verifySession('garbage', SECRET, NOW)).toBeNull();
  });
});

describe('auth cookies', () => {
  const httpsReq = new Request('https://admin.example/api/admin/login');
  const httpReq = new Request('http://127.0.0.1:8787/api/admin/login');

  it('sets Secure only for https request URLs', () => {
    const secure = buildAuthCookies(httpsReq, 't', 'c');
    const plain = buildAuthCookies(httpReq, 't', 'c');
    expect(secure[0]).toContain('; Secure');
    expect(secure[1]).toContain('; Secure');
    expect(plain[0]).not.toContain('Secure');
    expect(plain[1]).not.toContain('Secure');
  });

  it('makes bs_admin HttpOnly and SameSite=Strict, and bs_csrf readable by script', () => {
    const [admin, csrf] = buildAuthCookies(httpReq, 't', 'c');
    expect(admin).toMatch(/^bs_admin=t;/);
    expect(admin).toContain('HttpOnly');
    expect(admin).toContain('SameSite=Strict');
    expect(admin).toContain('Max-Age=28800');
    expect(csrf).toMatch(/^bs_csrf=c;/);
    expect(csrf).not.toContain('HttpOnly');
    expect(csrf).toContain('SameSite=Strict');
  });

  it('clears both cookies with Max-Age=0', () => {
    const cleared = clearAuthCookies(httpReq);
    expect(cleared).toHaveLength(2);
    for (const cookie of cleared) expect(cookie).toContain('Max-Age=0');
  });
});

describe('POST /api/admin/login', () => {
  beforeAll(async () => {
    await ensureAdmin();
  });

  it('returns 200 with cookies on success and no Secure flag over http', async () => {
    const res = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': freshIp() },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ username: ADMIN_USER });
    const cookies = res.headers.getSetCookie();
    expect(
      cookies.some(
        (c) => c.startsWith('bs_admin=') && c.includes('HttpOnly') && !c.includes('Secure'),
      ),
    ).toBe(true);
    expect(cookies.some((c) => c.startsWith('bs_csrf=') && !c.includes('HttpOnly'))).toBe(true);
  });

  it('sets Secure on both cookies when the request is https', async () => {
    const res = await SELF.fetch('https://beauty-store-api.example.workers.dev/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': freshIp() },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) expect(cookie).toContain('Secure');
  });

  it('gives the same 401 for a wrong password and an unknown user', async () => {
    const ip = freshIp();
    const wrong = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ username: ADMIN_USER, password: 'nope' }),
    });
    const unknown = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ username: 'nobody', password: 'nope' }),
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.headers.getSetCookie()).toHaveLength(0);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('locks out after 5 failures: the 6th attempt is 429 with Retry-After 900, even with the right password', async () => {
    const ip = freshIp();
    const attempt = (password: string) =>
      SELF.fetch(`${BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
        body: JSON.stringify({ username: ADMIN_USER, password }),
      });
    for (let i = 0; i < 5; i++) {
      expect((await attempt('wrong')).status, `failure ${i + 1}`).toBe(401);
    }
    const locked = await attempt('wrong');
    expect(locked.status).toBe(429);
    expect(locked.headers.get('Retry-After')).toBe('900');
    expect(((await locked.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
    expect((await attempt(ADMIN_PASSWORD)).status).toBe(429);
  });

  it('stores only the hashed IP under login:<ip_hash>', async () => {
    const ip = freshIp();
    await SELF.fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ username: ADMIN_USER, password: 'nope' }),
    });
    const key = `login:${await hashIp(ip)}`;
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ n: number }>();
    expect(row?.n).toBe(1);
    const raw = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ?')
      .bind(`login:${ip}`)
      .first<{ n: number }>();
    expect(raw?.n).toBe(0);
  });

  it('a successful login clears that IP failure count', async () => {
    const ip = freshIp();
    const attempt = (password: string) =>
      SELF.fetch(`${BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
        body: JSON.stringify({ username: ADMIN_USER, password }),
      });
    for (let i = 0; i < 4; i++) await attempt('wrong');
    expect((await attempt(ADMIN_PASSWORD)).status).toBe(200);
    for (let i = 0; i < 5; i++) {
      expect((await attempt('wrong')).status, `after clear ${i + 1}`).toBe(401);
    }
    expect((await attempt('wrong')).status).toBe(429);
  });

  it('rejects a malformed body with 400 and does not count it as a failure', async () => {
    const ip = freshIp();
    const res = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ username: ADMIN_USER, password: 1 }),
    });
    expect(res.status).toBe(400);
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ?')
      .bind(`login:${await hashIp(ip)}`)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});

describe('session endpoints', () => {
  beforeAll(async () => {
    await ensureAdmin();
  });

  it('GET /api/admin/session without a cookie is 401', async () => {
    const res = await adminFetch(null, 'GET', '/api/admin/session');
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('GET /api/admin/session with a valid cookie returns the username', async () => {
    const session = await login();
    const res = await adminFetch(session, 'GET', '/api/admin/session');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: ADMIN_USER });
  });

  it('rejects a tampered session cookie with 401', async () => {
    const session = await login();
    const tampered = session.cookie.replace('bs_admin=', 'bs_admin=x');
    const res = await adminFetch({ ...session, cookie: tampered }, 'GET', '/api/admin/session');
    expect(res.status).toBe(401);
  });

  it('logout needs CSRF and clears both cookies', async () => {
    const session = await login();
    const noCsrf = await adminFetch({ ...session, csrf: '' }, 'POST', '/api/admin/logout');
    expect(noCsrf.status).toBe(403);
    const res = await adminFetch(session, 'POST', '/api/admin/logout');
    expect(res.status).toBe(204);
    const cleared = res.headers.getSetCookie();
    expect(cleared.every((c) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('sessionFrom reads cookies from a login response', async () => {
    const res = await SELF.fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': freshIp() },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
    });
    const session = sessionFrom(res);
    expect(session.csrf).toMatch(/^[0-9a-f]{64}$/);
  });
});
