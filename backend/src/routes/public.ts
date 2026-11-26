import { Hono } from 'hono';
import {
  percentOff,
  ProductListQuerySchema,
  type SettingsMap,
  type CategoryDto,
  type CategoryType,
  type ImageDto,
  type ProductDetailDto,
  type ProductSummaryDto,
  type ServiceDto,
  type SettingKey,
  type VariantDto,
} from '@beauty-store/shared';
import type { AppEnv } from '../env';
import { apiError, issueFields } from '../http/errors';
import { CACHE_PUBLIC } from '../http/cache';

export const publicRoutes = new Hono<AppEnv>();

const SETTING_KEYS: SettingKey[] = [
  'business_name',
  'whatsapp_number',
  'address',
  'opening_hours',
  'banner_text',
];

/** Escapes LIKE wildcards so user text is matched literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Converts a stored thumb key into the public URL served by /images/*. */
function imageUrl(key: string): string {
  return `/images/${key}`;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  type: CategoryType;
  sort_order: number;
}

publicRoutes.get('/api/categories', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT id, name, slug, type, sort_order FROM categories ORDER BY sort_order, id',
  ).all<CategoryRow>();
  const categories: CategoryDto[] = result.results;
  c.header('Cache-Control', CACHE_PUBLIC);
  return c.json({ categories });
});

interface ProductSummaryRow {
  id: number;
  name: string;
  slug: string;
  category_slug: string;
  mrp_paise: number;
  price_paise: number;
  tags: string;
  in_stock: number;
  created_at: string;
  thumb_key: string | null;
}

function toSummary(row: ProductSummaryRow): ProductSummaryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category_slug: row.category_slug,
    mrp_paise: row.mrp_paise,
    price_paise: row.price_paise,
    percent_off: percentOff(row.mrp_paise, row.price_paise),
    tags: row.tags,
    in_stock: row.in_stock === 1,
    created_at: row.created_at,
    thumb_url: row.thumb_key === null ? null : imageUrl(row.thumb_key),
  };
}

/** Shared SELECT for list rows: the first image by sort order supplies the thumbnail. */
const SUMMARY_COLUMNS = `
  p.id, p.name, p.slug, c.slug AS category_slug, p.mrp_paise, p.price_paise, p.tags, p.created_at,
  EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0) AS in_stock,
  (SELECT i.thumb_r2_key FROM product_images i WHERE i.product_id = p.id
     ORDER BY i.sort_order, i.id LIMIT 1) AS thumb_key`;

const SORT_SQL = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price_paise ASC, p.id ASC',
  price_desc: 'p.price_paise DESC, p.id DESC',
  // v1 keeps no sales counters, so popularity falls back to newest.
  popularity: 'p.created_at DESC, p.id DESC',
} as const;

publicRoutes.get('/api/products', async (c) => {
  const raw = c.req.query();
  const toNumber = (value: string | undefined) =>
    value === undefined || value === '' ? undefined : Number(value);
  const parsed = ProductListQuerySchema.safeParse({
    ...raw,
    min_price: toNumber(raw.min_price),
    max_price: toNumber(raw.max_price),
    page: raw.page === '' ? undefined : raw.page,
    per_page: raw.per_page === '' ? undefined : raw.per_page,
  });
  if (!parsed.success) {
    return apiError(
      c,
      400,
      'validation_failed',
      'Invalid query parameters',
      issueFields(parsed.error.issues),
    );
  }
  const query = parsed.data;

  const where: string[] = ['p.is_active = 1'];
  const binds: (string | number)[] = [];
  if (query.category !== undefined) {
    where.push('c.slug = ?');
    binds.push(query.category);
  }
  if (query.q !== undefined && query.q !== '') {
    where.push("(p.name LIKE ? ESCAPE '\\' OR p.tags LIKE ? ESCAPE '\\')");
    const pattern = likePattern(query.q.toLowerCase());
    binds.push(pattern, pattern);
  }
  if (query.min_price !== undefined) {
    where.push('p.price_paise >= ?');
    binds.push(query.min_price);
  }
  if (query.max_price !== undefined) {
    where.push('p.price_paise <= ?');
    binds.push(query.max_price);
  }
  if (query.size !== undefined) {
    where.push(
      'EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.size = ? COLLATE NOCASE)',
    );
    binds.push(query.size);
  }
  if (query.colour !== undefined) {
    where.push(
      'EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.colour = ? COLLATE NOCASE)',
    );
    binds.push(query.colour);
  }
  if (query.in_stock === true) {
    where.push(
      'EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)',
    );
  }

  const fromSql = `FROM products p JOIN categories c ON c.id = p.category_id WHERE ${where.join(' AND ')}`;
  const orderSql = SORT_SQL[query.sort ?? 'newest'];
  const offset = (query.page - 1) * query.per_page;

  const [countResult, itemsResult] = await c.env.DB.batch<{ total: number } | ProductSummaryRow>([
    c.env.DB.prepare(`SELECT COUNT(*) AS total ${fromSql}`).bind(...binds),
    c.env.DB.prepare(
      `SELECT ${SUMMARY_COLUMNS} ${fromSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
    ).bind(...binds, query.per_page, offset),
  ]);
  const total = (countResult?.results[0] as { total: number } | undefined)?.total ?? 0;
  const items = ((itemsResult?.results as ProductSummaryRow[] | undefined) ?? []).map(toSummary);

  c.header('Cache-Control', CACHE_PUBLIC);
  return c.json({ items, page: query.page, per_page: query.per_page, total });
});

interface ProductDetailRow extends ProductSummaryRow {
  description: string;
}

publicRoutes.get('/api/products/:slug', async (c) => {
  const slug = c.req.param('slug');
  const row = await c.env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS}, p.description
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.is_active = 1`,
  )
    .bind(slug)
    .first<ProductDetailRow>();
  if (row === null) return apiError(c, 404, 'not_found', 'Product not found');

  const [variantRows, imageRows] = await c.env.DB.batch<VariantDto | ImageRow>([
    c.env.DB.prepare(
      'SELECT id, product_id, size, colour, sku, stock FROM product_variants WHERE product_id = ? ORDER BY id',
    ).bind(row.id),
    c.env.DB.prepare(
      'SELECT id, r2_key, thumb_r2_key, alt_text, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id',
    ).bind(row.id),
  ]);

  const variants = (variantRows?.results ?? []) as VariantDto[];
  const images: ImageDto[] = ((imageRows?.results ?? []) as ImageRow[]).map((img) => ({
    id: img.id,
    full_url: imageUrl(img.r2_key),
    thumb_url: imageUrl(img.thumb_r2_key),
    alt_text: img.alt_text,
    sort_order: img.sort_order,
  }));

  const product: ProductDetailDto = {
    ...toSummary(row),
    description: row.description,
    variants,
    images,
  };
  c.header('Cache-Control', CACHE_PUBLIC);
  return c.json({ product });
});

interface ImageRow {
  id: number;
  r2_key: string;
  thumb_r2_key: string;
  alt_text: string;
  sort_order: number;
}

interface ServiceRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  price_paise: number;
  duration_minutes: number;
  category_id: number;
  category_name: string;
  category_slug: string;
}

publicRoutes.get('/api/services', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.slug, s.description, s.price_paise, s.duration_minutes,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug
       FROM services s JOIN categories c ON c.id = s.category_id
      WHERE s.is_active = 1
      ORDER BY c.sort_order, c.id, s.id`,
  ).all<ServiceRow>();
  const services: ServiceDto[] = result.results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price_paise: row.price_paise,
    duration_minutes: row.duration_minutes,
    is_active: true,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
  }));
  c.header('Cache-Control', CACHE_PUBLIC);
  return c.json({ services });
});

publicRoutes.get('/api/settings', async (c) => {
  const result = await c.env.DB.prepare('SELECT key, value FROM settings').all<{
    key: SettingKey;
    value: string;
  }>();
  const settings = Object.fromEntries(SETTING_KEYS.map((k) => [k, ''])) as SettingsMap;
  for (const row of result.results) settings[row.key] = row.value;
  c.header('Cache-Control', CACHE_PUBLIC);
  return c.json({ settings });
});
