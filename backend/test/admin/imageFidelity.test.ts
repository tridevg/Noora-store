import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureAdmin, login, BASE, type Session } from './helpers';
import { loadFixtures } from '../fixtures';

// Byte fidelity through the real upload path: POST multipart -> D1 blob -> GET /images/:key.
// The upload validator checks the part's declared Content-Type and size only (no magic-byte
// check), so no JPEG or WebP header is prefixed. The payload is sent exactly as generated.

const PRODUCT_ID = 2;
const JPEG = 'image/jpeg';
const WEBP = 'image/webp';

/** Small valid-length thumb: the bytes are irrelevant to these tests, only the full part matters. */
const THUMB = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

/** Deterministic pseudo-random bytes (mulberry32 with a fixed seed). */
function seededBytes(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed >>> 0;
  for (let i = 0; i < length; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out[i] = (((t ^ (t >>> 14)) >>> 0) & 0xff) as number;
  }
  return out;
}

/** The 256-byte payload where byte i has value i (0x00 through 0xFF). */
function allByteValues(): Uint8Array {
  return Uint8Array.from({ length: 256 }, (_, i) => i);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function uploadFull(
  full: Uint8Array,
  type: string,
  session: Session,
): Promise<{ status: number; fullUrl: string | undefined }> {
  const form = new FormData();
  form.append('full', new Blob([full], { type }), 'full');
  form.append('thumb', new Blob([THUMB], { type: JPEG }), 'thumb');
  const res = await SELF.fetch(`${BASE}/api/admin/products/${PRODUCT_ID}/images`, {
    method: 'POST',
    headers: { Cookie: session.cookie, 'X-CSRF-Token': session.csrf },
    body: form,
  });
  if (res.status !== 201) return { status: res.status, fullUrl: undefined };
  const { image } = (await res.json()) as { image: { full_url: string } };
  return { status: res.status, fullUrl: image.full_url };
}

beforeAll(async () => {
  await ensureAdmin();
  await loadFixtures();
});

describe('image byte fidelity: upload then GET /images/:key', () => {
  it('returns the 256 byte values 0x00 to 0xFF unchanged, with the uploaded Content-Type', async () => {
    const payload = allByteValues();
    const session = await login();
    const up = await uploadFull(payload, JPEG, session);
    expect(up.status).toBe(201);
    expect(up.fullUrl).toBeDefined();

    const res = await SELF.fetch(`${BASE}${up.fullUrl}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(JPEG);

    const served = new Uint8Array(await res.arrayBuffer());
    expect(served.length).toBe(256);
    expect(Array.from(served)).toEqual(Array.from(payload));
    expect(await sha256Hex(served)).toBe(await sha256Hex(payload));
  });

  it('returns a 64 KB seeded binary payload unchanged, with the uploaded Content-Type', async () => {
    const payload = seededBytes(64 * 1024, 0x5eed_1234);
    // Guard against a degenerate generator: the payload must cover most byte values.
    expect(new Set(payload).size).toBeGreaterThan(240);
    const session = await login();
    const up = await uploadFull(payload, WEBP, session);
    expect(up.status).toBe(201);
    expect(up.fullUrl?.endsWith('-full.webp')).toBe(true);

    const res = await SELF.fetch(`${BASE}${up.fullUrl}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(WEBP);

    const served = new Uint8Array(await res.arrayBuffer());
    expect(served.length).toBe(payload.length);
    expect(Array.from(served)).toEqual(Array.from(payload));
    expect(await sha256Hex(served)).toBe(await sha256Hex(payload));
  });
});
