import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { checkRateLimit, clearRateLimit, hashIp, recordRateLimitHit } from '../src/http/rateLimit';

const MINUTE = 60 * 1000;

async function countRows(key: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

describe('rate limiter', () => {
  it('hashIp returns 64 lowercase hex characters and is stable', async () => {
    const a = await hashIp('198.51.100.7');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashIp('198.51.100.7')).toBe(a);
    expect(await hashIp('198.51.100.8')).not.toBe(a);
  });

  it('blocks at five hits inside the 15 minute window with retryAfterSec 900', async () => {
    const ipHash = await hashIp('198.51.100.20');
    const now = 1_800_000_000_000;
    for (let i = 0; i < 4; i++) {
      await recordRateLimitHit(env.DB, 'order', ipHash, now - i * MINUTE);
    }
    expect((await checkRateLimit(env.DB, 'order', ipHash, now)).allowed).toBe(true);
    await recordRateLimitHit(env.DB, 'order', ipHash, now);
    const blocked = await checkRateLimit(env.DB, 'order', ipHash, now);
    expect(blocked).toEqual({ allowed: false, retryAfterSec: 900 });
  });

  it('ignores hits older than 15 minutes', async () => {
    const ipHash = await hashIp('198.51.100.21');
    const now = 1_800_000_000_000;
    for (let i = 0; i < 5; i++) {
      await recordRateLimitHit(env.DB, 'order', ipHash, now - 16 * MINUTE);
    }
    expect(await checkRateLimit(env.DB, 'order', ipHash, now)).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });

  it('keeps buckets separate', async () => {
    const ipHash = await hashIp('198.51.100.22');
    const now = 1_800_000_000_000;
    for (let i = 0; i < 5; i++) {
      await recordRateLimitHit(env.DB, 'login', ipHash, now);
    }
    expect((await checkRateLimit(env.DB, 'login', ipHash, now)).allowed).toBe(false);
    expect((await checkRateLimit(env.DB, 'order', ipHash, now)).allowed).toBe(true);
  });

  it('prunes rows older than 24 hours on insert', async () => {
    const ipHash = await hashIp('198.51.100.23');
    const now = 1_800_000_000_000;
    await env.DB.prepare('INSERT INTO rate_limits (key, attempted_at) VALUES (?, ?)')
      .bind(`order:${ipHash}`, now - 25 * 60 * MINUTE)
      .run();
    expect(await countRows(`order:${ipHash}`)).toBe(1);
    await recordRateLimitHit(env.DB, 'order', ipHash, now);
    expect(await countRows(`order:${ipHash}`)).toBe(1);
    const row = await env.DB.prepare('SELECT attempted_at FROM rate_limits WHERE key = ?')
      .bind(`order:${ipHash}`)
      .first<{ attempted_at: number }>();
    expect(row?.attempted_at).toBe(now);
  });

  it('clearRateLimit deletes only the given bucket and IP', async () => {
    const ipHash = await hashIp('198.51.100.24');
    const now = Date.now();
    await recordRateLimitHit(env.DB, 'login', ipHash, now);
    await recordRateLimitHit(env.DB, 'order', ipHash, now);
    await clearRateLimit(env.DB, 'login', ipHash);
    expect(await countRows(`login:${ipHash}`)).toBe(0);
    expect(await countRows(`order:${ipHash}`)).toBe(1);
  });
});
