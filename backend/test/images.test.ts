import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const JPEG_KEY = 'products/9/22222222-2222-4222-8222-222222222222-full.jpg';

describe('GET /images/* reads D1 blobs', () => {
  it('returns the stored bytes with their stored Content-Type and the immutable cache header', async () => {
    await env.DB.prepare(
      "INSERT INTO product_image_blobs (key, content_type, data) VALUES (?, 'image/jpeg', ?)",
    )
      .bind(JPEG_KEY, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))
      .run();
    const res = await SELF.fetch(`http://localhost/images/${JPEG_KEY}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    );
  });

  it('returns 404 not_found for a missing key', async () => {
    const res = await SELF.fetch('http://localhost/images/products/9/missing-full.webp');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found');
  });

  it('returns 400 for a key containing ..', async () => {
    // A bare ".." segment is normalised by URL parsing, so the key carries ".." inside a segment.
    const res = await SELF.fetch('http://localhost/images/products/a..b/secret.webp');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'validation_failed',
    );
  });
});
