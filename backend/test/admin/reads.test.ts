import { beforeAll, describe, expect, it } from 'vitest';
import {
  AdminProductResponseSchema,
  AdminServiceResponseSchema,
  AdminServicesResponseSchema,
} from '@beauty-store/shared';
import { adminFetch, ensureAdmin, login } from './helpers';
import { loadFixtures } from '../fixtures';

beforeAll(async () => {
  await ensureAdmin();
  await loadFixtures();
});

describe('GET /api/admin/products/:id', () => {
  it('returns an active product with variants and images, matching the shared schema', async () => {
    const session = await login();
    const res = await adminFetch(session, 'GET', '/api/admin/products/1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const parsed = AdminProductResponseSchema.safeParse(await res.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.product.slug).toBe('silk-saree');
    expect(parsed.data.product.variants).toHaveLength(2);
    expect(parsed.data.product.images).toHaveLength(1);
    expect(parsed.data.product.is_active).toBe(true);
  });

  it('includes inactive products', async () => {
    const session = await login();
    const res = await adminFetch(session, 'GET', '/api/admin/products/3');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { product: { slug: string; is_active: boolean } };
    expect(body.product.slug).toBe('hidden-top');
    expect(body.product.is_active).toBe(false);
  });

  it('returns 404 not_found for unknown ids and for non-numeric ids', async () => {
    const session = await login();
    for (const path of ['/api/admin/products/999999', '/api/admin/products/abc']) {
      const res = await adminFetch(session, 'GET', path);
      expect(res.status, path).toBe(404);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found');
    }
  });

  it('requires a session', async () => {
    const res = await adminFetch(null, 'GET', '/api/admin/products/1');
    expect(res.status).toBe(401);
  });

  it('does not need the CSRF header', async () => {
    const session = await login();
    const res = await adminFetch({ ...session, csrf: '' }, 'GET', '/api/admin/products/1');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/services', () => {
  it('lists active and inactive services with their category, matching the shared schema', async () => {
    const session = await login();
    const res = await adminFetch(session, 'GET', '/api/admin/services');
    expect(res.status).toBe(200);
    const parsed = AdminServicesResponseSchema.safeParse(await res.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const slugs = parsed.data.services.map((s) => s.slug);
    expect(slugs).toEqual(expect.arrayContaining(['haircut', 'old-service']));
    const inactive = parsed.data.services.find((s) => s.slug === 'old-service');
    expect(inactive?.is_active).toBe(false);
    expect(parsed.data.services[0]?.category.slug).toBe('hair');
  });

  it('requires a session', async () => {
    const res = await adminFetch(null, 'GET', '/api/admin/services');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/services/:id', () => {
  it('returns an inactive service by id', async () => {
    const session = await login();
    const res = await adminFetch(session, 'GET', '/api/admin/services/2');
    expect(res.status).toBe(200);
    const parsed = AdminServiceResponseSchema.safeParse(await res.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.service.slug).toBe('old-service');
    expect(parsed.data.service.is_active).toBe(false);
  });

  it('returns 404 not_found for an unknown id', async () => {
    const session = await login();
    const res = await adminFetch(session, 'GET', '/api/admin/services/999999');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found');
  });

  it('requires a session', async () => {
    const res = await adminFetch(null, 'GET', '/api/admin/services/1');
    expect(res.status).toBe(401);
  });
});
