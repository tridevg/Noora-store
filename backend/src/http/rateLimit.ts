export type RateBucket = 'login' | 'order';

/** Window, limit and retry hint for the rate_limits table (R7, R16). */
export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT = 5;
export const RATE_RETRY_AFTER_SEC = 900;
const PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

/** Hex SHA-256 of the client IP. Raw IPs are never stored. */
export async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Counts hits for `${bucket}:${ipHash}` in the last 15 minutes. Blocks at 5 or more. */
export async function checkRateLimit(
  db: D1Database,
  bucket: RateBucket,
  ipHash: string,
  nowMs: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const row = await db
    .prepare('SELECT COUNT(*) AS hits FROM rate_limits WHERE key = ? AND attempted_at > ?')
    .bind(`${bucket}:${ipHash}`, nowMs - RATE_WINDOW_MS)
    .first<{ hits: number }>();
  const hits = row?.hits ?? 0;
  if (hits >= RATE_LIMIT) return { allowed: false, retryAfterSec: RATE_RETRY_AFTER_SEC };
  return { allowed: true, retryAfterSec: 0 };
}

/** Records one hit, then prunes rows older than 24 hours. */
export async function recordRateLimitHit(
  db: D1Database,
  bucket: RateBucket,
  ipHash: string,
  nowMs: number,
): Promise<void> {
  await db.batch([
    db
      .prepare('INSERT INTO rate_limits (key, attempted_at) VALUES (?, ?)')
      .bind(`${bucket}:${ipHash}`, nowMs),
    db.prepare('DELETE FROM rate_limits WHERE attempted_at < ?').bind(nowMs - PRUNE_AGE_MS),
  ]);
}

/** Deletes every row for `${bucket}:${ipHash}` (used after a successful login). */
export async function clearRateLimit(
  db: D1Database,
  bucket: RateBucket,
  ipHash: string,
): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(`${bucket}:${ipHash}`).run();
}
