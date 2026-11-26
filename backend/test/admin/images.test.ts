import { SELF, env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureAdmin, login, BASE, type Session } from './helpers';
import { loadFixtures } from '../fixtures';
import { linkImageWithBlobs } from '../../src/admin/imageBlobs';

const KB = 1000;
const WEBP = 'image/webp';
const JPEG = 'image/jpeg';

function blob(size: number, type: string, fill = 1): Blob {
  return new Blob([new Uint8Array(size).fill(fill)], { type });
}

function imageForm(parts: { full?: Blob; thumb?: Blob }, fields: Record<string, string> = {}) {
  const form = new FormData();
  if (parts.full) form.append('full', parts.full, 'full');
  if (parts.thumb) form.append('thumb', parts.thumb, 'thumb');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

async function postImages(
  productId: number,
  body: BodyInit,
  session?: Session,
  headers: Record<string, string> = {},
): Promise<Response> {
  const s = session ?? (await login());
  return SELF.fetch(`${BASE}/api/admin/products/${productId}/images`, {
    method: 'POST',
    headers: { Cookie: s.cookie, 'X-CSRF-Token': s.csrf, ...headers },
    body,
  });
}

async function count(sql: string, ...binds: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql)
    .bind(...binds)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const IMAGE_COUNT_SQL = 'SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?';
const BLOB_COUNT_SQL = 'SELECT COUNT(*) AS n FROM product_image_blobs';

beforeAll(async () => {
  await ensureAdmin();
  await loadFixtures();
});

describe('POST /api/admin/products/:id/images: size and type limits', () => {
  it('accepts a full image of exactly 500,000 bytes and a thumb of exactly 300,000 bytes', async () => {
    const res = await postImages(
      2,
      imageForm({ full: blob(500 * KB, WEBP), thumb: blob(300 * KB, WEBP) }),
    );
    expect(res.status).toBe(201);
    const { image } = (await res.json()) as { image: { full_url: string; thumb_url: string } };
    expect(image.full_url).toMatch(/^\/images\/products\/2\/.+-full\.webp$/);
    expect(image.thumb_url).toMatch(/^\/images\/products\/2\/.+-thumb\.webp$/);
  });

  it('returns 413 for a full image one byte over 500,000', async () => {
    const before = await count(IMAGE_COUNT_SQL, 2);
    const res = await postImages(
      2,
      imageForm({ full: blob(500 * KB + 1, WEBP), thumb: blob(1 * KB, WEBP) }),
    );
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'validation_failed',
    );
    expect(await count(IMAGE_COUNT_SQL, 2)).toBe(before);
  });

  it('returns 413 for a thumb one byte over 300,000', async () => {
    const res = await postImages(
      2,
      imageForm({ full: blob(1 * KB, WEBP), thumb: blob(300 * KB + 1, WEBP) }),
    );
    expect(res.status).toBe(413);
  });

  it('returns 413 when the whole body exceeds the combined limit', async () => {
    const res = await postImages(
      2,
      imageForm({ full: blob(500 * KB, WEBP), thumb: blob(400 * KB, WEBP) }),
    );
    expect(res.status).toBe(413);
  });

  it('rejects image/png with 400 and writes nothing', async () => {
    const before = await count(BLOB_COUNT_SQL);
    const res = await postImages(
      2,
      imageForm({ full: blob(10, 'image/png'), thumb: blob(10, WEBP) }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields: Record<string, string> } };
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.fields.full).toBe('unsupported type');
    expect(await count(BLOB_COUNT_SQL)).toBe(before);
  });

  it('rejects an empty part with 400', async () => {
    const res = await postImages(2, imageForm({ full: blob(0, WEBP), thumb: blob(10, WEBP) }));
    expect(res.status).toBe(400);
  });

  it('rejects a request missing the thumb part with 400', async () => {
    const res = await postImages(2, imageForm({ full: blob(10, WEBP) }));
    expect(res.status).toBe(400);
  });

  it('rejects a non-multipart body with 400', async () => {
    const res = await postImages(2, JSON.stringify({ full_r2_key: 'x' }), undefined, {
      'Content-Type': 'application/json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown product', async () => {
    const res = await postImages(9999, imageForm({ full: blob(10, WEBP), thumb: blob(10, WEBP) }));
    expect(res.status).toBe(404);
  });

  it('requires a session', async () => {
    const res = await SELF.fetch(`${BASE}/api/admin/products/2/images`, {
      method: 'POST',
      body: imageForm({ full: blob(10, WEBP), thumb: blob(10, WEBP) }),
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/products/:id/images: link and blob batch', () => {
  it('stores a JPEG pair and serves the full image with its real Content-Type', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const res = await postImages(
      2,
      imageForm(
        { full: new Blob([jpeg], { type: JPEG }), thumb: new Blob([jpeg], { type: JPEG }) },
        { alt_text: 'Kurti front', sort_order: '3' },
      ),
    );
    expect(res.status).toBe(201);
    const { image } = (await res.json()) as {
      image: { full_url: string; alt_text: string; sort_order: number };
    };
    expect(image.alt_text).toBe('Kurti front');
    expect(image.sort_order).toBe(3);
    expect(image.full_url.endsWith('-full.jpg')).toBe(true);

    const served = await SELF.fetch(`${BASE}${image.full_url}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('Content-Type')).toBe(JPEG);
    expect(served.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(jpeg);
  });

  it('writes the link and both blobs in one batch: a failing blob write leaves no rows', async () => {
    const linksBefore = await count(IMAGE_COUNT_SQL, 2);
    const blobsBefore = await count(BLOB_COUNT_SQL);
    // A null blob violates NOT NULL on product_image_blobs.data, so the whole batch must roll back.
    await expect(
      linkImageWithBlobs(env.DB, {
        productId: 2,
        full: { contentType: WEBP, data: new Uint8Array([1, 2, 3]) },
        thumb: { contentType: WEBP, data: null as unknown as Uint8Array },
        altText: '',
        sortOrder: 0,
      }),
    ).rejects.toThrow();
    expect(await count(IMAGE_COUNT_SQL, 2)).toBe(linksBefore);
    expect(await count(BLOB_COUNT_SQL)).toBe(blobsBefore);
  });
});

describe('DELETE /api/admin/products/:id/images/:imageId', () => {
  it('removes the link and both blob rows in one batch', async () => {
    const session = await login();
    const res = await postImages(
      2,
      imageForm({ full: blob(20, WEBP, 7), thumb: blob(10, WEBP, 8) }),
      session,
    );
    expect(res.status).toBe(201);
    const { image } = (await res.json()) as { image: { id: number; full_url: string } };
    const fullKey = decodeURIComponent(image.full_url.slice('/images/'.length));
    const thumbKey = fullKey.replace(/-full\.webp$/, '-thumb.webp');
    expect(await count(BLOB_COUNT_SQL)).toBeGreaterThan(0);

    const del = await SELF.fetch(`${BASE}/api/admin/products/2/images/${image.id}`, {
      method: 'DELETE',
      headers: { Cookie: session.cookie, 'X-CSRF-Token': session.csrf },
    });
    expect(del.status).toBe(204);
    expect(
      await count(
        'SELECT COUNT(*) AS n FROM product_image_blobs WHERE key IN (?, ?)',
        fullKey,
        thumbKey,
      ),
    ).toBe(0);
    expect(await SELF.fetch(`${BASE}${image.full_url}`).then((r) => r.status)).toBe(404);
  });

  it('keeps a blob whose key is still referenced by another image row', async () => {
    const session = await login();
    const res = await postImages(
      2,
      imageForm({ full: blob(20, WEBP, 9), thumb: blob(10, WEBP, 9) }),
      session,
    );
    const { image } = (await res.json()) as { image: { id: number; full_url: string } };
    const fullKey = decodeURIComponent(image.full_url.slice('/images/'.length));
    const thumbKey = fullKey.replace(/-full\.webp$/, '-thumb.webp');
    // Another link points at the same thumb key. thumb_r2_key is not UNIQUE, so this is allowed.
    await env.DB.prepare(
      'INSERT INTO product_images (product_id, r2_key, thumb_r2_key, alt_text, sort_order) VALUES (2, ?, ?, ?, 9)',
    )
      .bind('products/2/99999999-9999-4999-8999-999999999999-full.webp', thumbKey, '')
      .run();

    const del = await SELF.fetch(`${BASE}/api/admin/products/2/images/${image.id}`, {
      method: 'DELETE',
      headers: { Cookie: session.cookie, 'X-CSRF-Token': session.csrf },
    });
    expect(del.status).toBe(204);
    expect(
      await count('SELECT COUNT(*) AS n FROM product_image_blobs WHERE key = ?', fullKey),
    ).toBe(0);
    expect(
      await count('SELECT COUNT(*) AS n FROM product_image_blobs WHERE key = ?', thumbKey),
    ).toBe(1);
  });
});

describe('GET /images/*', () => {
  it('returns 404 not_found for an unknown key', async () => {
    const res = await SELF.fetch('http://localhost/images/products/9/missing-full.webp');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found');
  });

  it('returns 400 for a key containing ..', async () => {
    const res = await SELF.fetch('http://localhost/images/products/a..b/secret.webp');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'validation_failed',
    );
  });

  it('serves a seeded fixture blob with its stored Content-Type and the immutable header', async () => {
    const res = await SELF.fetch(
      'http://localhost/images/products/1/11111111-1111-4111-8111-111111111111-full.webp',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(WEBP);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });
});
