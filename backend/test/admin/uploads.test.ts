import { SELF, env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureAdmin, login, BASE } from './helpers';
import { loadFixtures } from '../fixtures';

const UUID = '33333333-3333-4333-8333-333333333333';
const FULL_JPG = `products/1/${UUID}-full.jpg`;
const FULL_WEBP = `products/1/${UUID}-full.webp`;
const THUMB_WEBP = `products/1/${UUID}-thumb.webp`;

const MB = 1024 * 1024;

async function upload(
  key: string,
  body: BodyInit,
  contentType: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const session = await login();
  return SELF.fetch(`${BASE}/api/admin/uploads?key=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      Cookie: session.cookie,
      'X-CSRF-Token': session.csrf,
      'Content-Type': contentType,
      ...headers,
    },
    body,
  });
}

beforeAll(async () => {
  await ensureAdmin();
  await loadFixtures();
});

describe('PUT /api/admin/uploads', () => {
  it('rejects a key with .. with 400', async () => {
    const res = await upload(
      `products/1/../../${UUID}-full.jpg`,
      new Uint8Array([1]),
      'image/jpeg',
    );
    expect(res.status).toBe(400);
  });

  it('rejects image/png with 400', async () => {
    const res = await upload(FULL_JPG, new Uint8Array([1, 2, 3]), 'image/png');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'validation_failed',
    );
  });

  it('rejects image/webp bytes under a .jpg key with 400', async () => {
    const res = await upload(FULL_JPG, new Uint8Array([1, 2, 3]), 'image/webp');
    expect(res.status).toBe(400);
  });

  it('returns 413 for a full image over 3 MB (declared Content-Length)', async () => {
    const res = await upload(FULL_WEBP, new Uint8Array(3 * MB + 1), 'image/webp');
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'validation_failed',
    );
  });

  it('returns 413 for a thumb over 300 KB', async () => {
    const res = await upload(THUMB_WEBP, new Uint8Array(300 * 1024 + 1), 'image/webp');
    expect(res.status).toBe(413);
  });

  it('accepts a thumb of exactly 300 KB', async () => {
    const key = `products/1/${'4'.repeat(8)}-4444-4444-8444-${'4'.repeat(12)}-thumb.webp`;
    const res = await upload(key, new Uint8Array(300 * 1024), 'image/webp');
    expect(res.status).toBe(201);
  });

  it('stores a valid JPEG with its real Content-Type and serves it from /images', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const res = await upload(FULL_JPG, jpeg, 'image/jpeg; charset=binary');
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ key: FULL_JPG, size: 4 });

    const stored = await env.IMAGES.head(FULL_JPG);
    expect(stored?.httpMetadata?.contentType).toBe('image/jpeg');

    const served = await SELF.fetch(`${BASE}/images/${FULL_JPG}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('refuses to overwrite an existing object with 409', async () => {
    const res = await upload(FULL_JPG, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg');
    expect(res.status).toBe(409);
  });

  it('rejects an empty body with 400', async () => {
    const key = `products/1/${'5'.repeat(8)}-5555-4555-8555-${'5'.repeat(12)}-full.webp`;
    const res = await upload(key, new Uint8Array(0), 'image/webp');
    expect(res.status).toBe(400);
  });

  it('requires a session', async () => {
    const res = await SELF.fetch(`${BASE}/api/admin/uploads?key=${encodeURIComponent(FULL_WEBP)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: new Uint8Array([1]),
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/products/:id/images', () => {
  it('returns 409 when the uploaded objects are missing', async () => {
    const session = await login();
    const res = await SELF.fetch(`${BASE}/api/admin/products/2/images`, {
      method: 'POST',
      headers: {
        Cookie: session.cookie,
        'X-CSRF-Token': session.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        full_r2_key: `products/2/${UUID}-full.jpg`,
        thumb_r2_key: `products/2/${UUID}-thumb.jpg`,
        alt_text: '',
        sort_order: 0,
      }),
    });
    expect(res.status).toBe(409);
  });
});
