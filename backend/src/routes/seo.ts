import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { CACHE_PUBLIC } from '../http/cache';

/** Public storefront routes that belong in the sitemap (admin, cart and auth pages are excluded). */
const STATIC_PATHS = [
  '/',
  '/products',
  '/services',
  '/about',
  '/contact',
  '/shipping-returns',
  '/privacy-policy',
];

/**
 * Origin used in absolute URLs. Behind the Pages proxy the Worker sees its own workers.dev host,
 * so SITE_URL (when set) wins over the request origin.
 */
export function siteOrigin(env: Pick<AppEnv['Bindings'], 'SITE_URL'>, request: Request): string {
  const configured = env.SITE_URL?.trim().replace(/\/+$/, '');
  return configured ? configured : new URL(request.url).origin;
}

/** Escapes the five XML special characters. */
export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Builds sitemap XML for the static routes, active products and every category. */
export function buildSitemap(
  origin: string,
  products: readonly { slug: string; updated_at: string }[],
  categorySlugs: readonly string[],
): string {
  const urls: string[] = [];
  const add = (path: string, lastmod?: string) => {
    const loc = xmlEscape(`${origin}${path}`);
    urls.push(
      lastmod
        ? `  <url><loc>${loc}</loc><lastmod>${xmlEscape(lastmod)}</lastmod></url>`
        : `  <url><loc>${loc}</loc></url>`,
    );
  };
  for (const path of STATIC_PATHS) add(path);
  for (const c of categorySlugs) add(`/category/${encodeURIComponent(c)}`);
  for (const p of products) {
    add(`/product/${encodeURIComponent(p.slug)}`, p.updated_at.slice(0, 10));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Builds robots.txt. Keeps crawlers out of admin, API and cart pages and points at the sitemap. */
export function buildRobots(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /cart',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export const seoRoutes = new Hono<AppEnv>();

seoRoutes.get('/sitemap.xml', async (c) => {
  const products = await c.env.DB.prepare(
    'SELECT slug, updated_at FROM products WHERE is_active = 1 ORDER BY id',
  ).all<{ slug: string; updated_at: string }>();
  const categories = await c.env.DB.prepare(
    'SELECT slug FROM categories ORDER BY sort_order, id',
  ).all<{ slug: string }>();
  const xml = buildSitemap(
    siteOrigin(c.env, c.req.raw),
    products.results,
    categories.results.map((r) => r.slug),
  );
  c.header('Cache-Control', CACHE_PUBLIC);
  c.header('Content-Type', 'application/xml; charset=utf-8');
  return c.body(xml);
});

seoRoutes.get('/robots.txt', (c) => {
  c.header('Cache-Control', CACHE_PUBLIC);
  c.header('Content-Type', 'text/plain; charset=utf-8');
  return c.body(buildRobots(siteOrigin(c.env, c.req.raw)));
});
