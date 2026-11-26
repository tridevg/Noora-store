import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadFixtures } from './fixtures';

const CACHE = 'public, s-maxage=300, stale-while-revalidate=60';

beforeAll(async () => {
  await loadFixtures();
});

describe('public reads', () => {
  it('GET /api/categories returns categories with the exact cache header', async () => {
    const res = await SELF.fetch('http://localhost/api/categories');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE);
    const body = (await res.json()) as { categories: { slug: string; type: string }[] };
    expect(body.categories.map((c) => c.slug)).toContain('sarees');
  });

  it('GET /api/products omits inactive products and returns integer prices', async () => {
    const res = await SELF.fetch('http://localhost/api/products');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE);
    const body = (await res.json()) as {
      items: { slug: string; price_paise: number; mrp_paise: number; percent_off: number }[];
      page: number;
      per_page: number;
      total: number;
    };
    const slugs = body.items.map((i) => i.slug);
    expect(slugs).not.toContain('hidden-top');
    expect(slugs).toEqual(expect.arrayContaining(['silk-saree', 'cotton-kurti']));
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.per_page).toBe(24);
    for (const item of body.items) {
      expect(Number.isInteger(item.price_paise)).toBe(true);
      expect(Number.isInteger(item.mrp_paise)).toBe(true);
      expect(Number.isInteger(item.percent_off)).toBe(true);
    }
    const saree = body.items.find((i) => i.slug === 'silk-saree');
    expect(saree?.percent_off).toBe(20);
  });

  it('GET /api/products applies q, price range, in_stock and pagination', async () => {
    const q = (await (await SELF.fetch('http://localhost/api/products?q=KURTI')).json()) as {
      items: { slug: string }[];
    };
    expect(q.items.map((i) => i.slug)).toEqual(['cotton-kurti']);

    const price = (await (
      await SELF.fetch('http://localhost/api/products?min_price=100000&max_price=130000')
    ).json()) as { items: { slug: string }[] };
    expect(price.items.map((i) => i.slug)).toEqual(['silk-saree']);

    const stock = (await (await SELF.fetch('http://localhost/api/products?in_stock=1')).json()) as {
      items: { slug: string; in_stock: boolean }[];
    };
    expect(stock.items.map((i) => i.slug)).toEqual(['silk-saree']);
    expect(stock.items[0]?.in_stock).toBe(true);

    const page = (await (
      await SELF.fetch('http://localhost/api/products?per_page=1&page=2&sort=price_asc')
    ).json()) as { items: { slug: string }[]; total: number };
    expect(page.total).toBe(2);
    expect(page.items.map((i) => i.slug)).toEqual(['silk-saree']);
  });

  it('GET /api/products rejects per_page=49 with validation_failed', async () => {
    const res = await SELF.fetch('http://localhost/api/products?per_page=49');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_failed');
  });

  it('GET /api/products/:slug returns variants and images, and 404 for inactive slugs', async () => {
    const res = await SELF.fetch('http://localhost/api/products/silk-saree');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE);
    const body = (await res.json()) as {
      product: {
        variants: { sku: string; stock: number }[];
        images: { full_url: string; thumb_url: string }[];
        description: string;
      };
    };
    expect(body.product.variants).toHaveLength(2);
    expect(body.product.images[0]?.full_url).toMatch(/^\/images\/products\/1\//);
    expect(body.product.description).toBe('Red silk');

    const missing = await SELF.fetch('http://localhost/api/products/hidden-top');
    expect(missing.status).toBe(404);
    expect((await missing.json()) as { error: { code: string } }).toMatchObject({
      error: { code: 'not_found' },
    });
  });

  it('GET /api/services returns only active services with a category object', async () => {
    const res = await SELF.fetch('http://localhost/api/services');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE);
    const body = (await res.json()) as {
      services: { slug: string; price_paise: number; category: { slug: string } }[];
    };
    expect(body.services.map((s) => s.slug)).toEqual(['haircut']);
    expect(body.services[0]?.category.slug).toBe('hair');
    expect(Number.isInteger(body.services[0]?.price_paise)).toBe(true);
  });

  it('GET /api/settings returns all five keys with the exact cache header', async () => {
    const res = await SELF.fetch('http://localhost/api/settings');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE);
    const body = (await res.json()) as { settings: Record<string, string> };
    expect(Object.keys(body.settings).sort()).toEqual([
      'address',
      'banner_text',
      'business_name',
      'opening_hours',
      'whatsapp_number',
    ]);
    expect(body.settings.business_name).toBe('Test Parlour');
  });

  it('unknown routes return the error envelope with not_found', async () => {
    const res = await SELF.fetch('http://localhost/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } });
  });
});
