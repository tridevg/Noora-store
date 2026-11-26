import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadFixtures } from './fixtures';

const CACHE = 'public, s-maxage=300, stale-while-revalidate=60';

beforeAll(async () => {
  await loadFixtures();
});

describe('GET /sitemap.xml', () => {
  it('lists static routes, active products and every category, with the public cache header', async () => {
    const res = await SELF.fetch('http://localhost/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE);
    expect(res.headers.get('Content-Type')).toContain('application/xml');
    const xml = await res.text();
    expect(xml).toContain('<loc>http://localhost/products</loc>');
    expect(xml).toContain('<loc>http://localhost/privacy-policy</loc>');
    expect(xml).toContain('<loc>http://localhost/product/silk-saree</loc>');
    expect(xml).toContain('<loc>http://localhost/product/cotton-kurti</loc>');
    expect(xml).toContain('<loc>http://localhost/category/sarees</loc>');
    expect(xml).toContain('<loc>http://localhost/category/hair</loc>');
  });

  it('omits inactive products and admin or cart URLs', async () => {
    const xml = await (await SELF.fetch('http://localhost/sitemap.xml')).text();
    expect(xml).not.toContain('hidden-top');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/cart');
  });

  it('uses the request origin as the base when SITE_URL is unset', async () => {
    const xml = await (await SELF.fetch('https://shop.example.test/sitemap.xml')).text();
    expect(xml).toContain('<loc>https://shop.example.test/products</loc>');
  });
});

describe('GET /robots.txt', () => {
  it('disallows admin, api and cart and points at the sitemap', async () => {
    const res = await SELF.fetch('https://shop.example.test/robots.txt');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('User-agent: *');
    expect(text).toContain('Disallow: /admin');
    expect(text).toContain('Disallow: /api/');
    expect(text).toContain('Disallow: /cart');
    expect(text).toContain('Sitemap: https://shop.example.test/sitemap.xml');
  });
});
