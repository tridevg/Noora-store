import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureAdmin, login, BASE } from './helpers';
import { ADMIN_ORIGIN_ALLOWLIST } from '../../src/admin/origin';

// The logout route is used as a probe: with a valid session and CSRF token it returns 204
// when the Origin check passes, and 403 when it does not.

async function postLogout(origin: string | null) {
  const session = await login();
  const headers: Record<string, string> = {
    Cookie: session.cookie,
    'X-CSRF-Token': session.csrf,
  };
  if (origin !== null) headers.Origin = origin;
  return SELF.fetch(`${BASE}/api/admin/logout`, { method: 'POST', headers });
}

beforeAll(async () => {
  await ensureAdmin();
});

describe('admin mutation Origin allowlist', () => {
  it('includes noora-studio.pages.dev alongside noora-2yi.pages.dev', () => {
    expect(ADMIN_ORIGIN_ALLOWLIST).toContain('https://noora-studio.pages.dev');
    expect(ADMIN_ORIGIN_ALLOWLIST).toContain('https://noora-2yi.pages.dev');
  });

  it('accepts a POST from https://noora-studio.pages.dev', async () => {
    const res = await postLogout('https://noora-studio.pages.dev');
    expect(res.status).toBe(204);
  });

  it('rejects a POST from an unknown origin with 403', async () => {
    const res = await postLogout('https://evil.example.com');
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('csrf_failed');
  });

  it('does not check GET requests, so a session read from an unknown origin still succeeds', async () => {
    const session = await login();
    const res = await SELF.fetch(`${BASE}/api/admin/session`, {
      headers: { Cookie: session.cookie, Origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(200);
  });
});
