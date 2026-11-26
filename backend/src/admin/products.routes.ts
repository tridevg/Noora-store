import { Hono } from 'hono';
import {
  AdminProductListQuerySchema,
  ImageCreateSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  percentOff,
  type AdminProductDto,
  type ImageDto,
  type VariantDto,
} from '@beauty-store/shared';
import { apiError } from '../http/errors';
import { purgePublicCache } from '../cache/purge';
import { clientOrigin } from './origin';
import {
  dbWriteError,
  likePattern,
  parseId,
  parseJson,
  toImageDto,
  toVariantDto,
  type ImageRow,
  type VariantRow,
} from './data';
import type { AdminEnv } from './middleware';
import { categoryExists, type Db } from './queries';

interface ProductRow {
  id: number;
  category_id: number;
  category_slug: string;
  name: string;
  slug: string;
  description: string;
  tags: string;
  mrp_paise: number;
  price_paise: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const PRODUCT_COLUMNS = `p.id, p.category_id, c.slug AS category_slug, p.name, p.slug, p.description,
  p.tags, p.mrp_paise, p.price_paise, p.is_active, p.created_at, p.updated_at`;

/** Builds AdminProductDto rows for the given products with two batched child queries (no N+1). */
export async function loadAdminProducts(db: Db, rows: ProductRow[]): Promise<AdminProductDto[]> {
  if (rows.length === 0) return [];
  const placeholders = rows.map(() => '?').join(', ');
  const ids = rows.map((r) => r.id);
  const [variantResult, imageResult] = await db.batch<VariantRow | ImageRow>([
    db
      .prepare(
        `SELECT id, product_id, size, colour, sku, stock FROM product_variants
          WHERE product_id IN (${placeholders}) ORDER BY id`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT id, product_id, r2_key, thumb_r2_key, alt_text, sort_order FROM product_images
          WHERE product_id IN (${placeholders}) ORDER BY sort_order, id`,
      )
      .bind(...ids),
  ]);
  const variantsBy = new Map<number, VariantDto[]>();
  for (const v of (variantResult?.results ?? []) as VariantRow[]) {
    const list = variantsBy.get(v.product_id) ?? [];
    list.push(toVariantDto(v));
    variantsBy.set(v.product_id, list);
  }
  const imagesBy = new Map<number, ImageDto[]>();
  for (const i of (imageResult?.results ?? []) as ImageRow[]) {
    const list = imagesBy.get(i.product_id) ?? [];
    list.push(toImageDto(i));
    imagesBy.set(i.product_id, list);
  }

  return rows.map((row) => {
    const variants = variantsBy.get(row.id) ?? [];
    const images = imagesBy.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category_id: row.category_id,
      category_slug: row.category_slug,
      mrp_paise: row.mrp_paise,
      price_paise: row.price_paise,
      percent_off: percentOff(row.mrp_paise, row.price_paise),
      tags: row.tags,
      in_stock: variants.some((v) => v.stock > 0),
      created_at: row.created_at,
      thumb_url: images[0]?.thumb_url ?? null,
      description: row.description,
      variants,
      images,
      is_active: row.is_active === 1,
      updated_at: row.updated_at,
    };
  });
}

async function loadProductRow(db: Db, id: number): Promise<ProductRow | null> {
  return db
    .prepare(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
    )
    .bind(id)
    .first<ProductRow>();
}

/** Minimal lookup used for slugs (purge) and existence checks. */
async function productSlug(db: Db, id: number): Promise<string | null> {
  const row = await db
    .prepare('SELECT slug FROM products WHERE id = ?')
    .bind(id)
    .first<{ slug: string }>();
  return row?.slug ?? null;
}

export const productsRoutes = new Hono<AdminEnv>();

/** GET /api/admin/products: includes inactive products. */
productsRoutes.get('/products', async (c) => {
  const parsed = AdminProductListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return apiError(c, 400, 'validation_failed', 'Invalid query parameters');
  }
  const { page, per_page: perPage, q } = parsed.data;
  const db = c.env.DB;
  const where: string[] = ['1 = 1'];
  const binds: (string | number)[] = [];
  if (q !== undefined && q !== '') {
    where.push("(p.name LIKE ? ESCAPE '\\' OR p.tags LIKE ? ESCAPE '\\')");
    const pattern = likePattern(q.toLowerCase());
    binds.push(pattern, pattern);
  }
  const whereSql = where.join(' AND ');
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}`)
    .bind(...binds)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
        WHERE ${whereSql} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...binds, perPage, (page - 1) * perPage)
    .all<ProductRow>();
  const items = await loadAdminProducts(db, rows.results);
  return c.json({ items, page, per_page: perPage, total: countRow?.total ?? 0 });
});

/** POST /api/admin/products: session + CSRF. Purges public cache. */
/** GET /api/admin/products/:id: includes inactive products, with variants and images. */
productsRoutes.get('/products/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const row = id === null ? null : await loadProductRow(c.env.DB, id);
  if (id === null || row === null) return apiError(c, 404, 'not_found', 'Product not found');
  const product = (await loadAdminProducts(c.env.DB, [row]))[0]!;
  return c.json({ product });
});

/** POST /api/admin/products: session + CSRF. Purges public cache. */
productsRoutes.post('/products', async (c) => {
  const parsed = await parseJson(c, (v) => ProductCreateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;
  if (!(await categoryExists(c.env.DB, data.category_id))) {
    return apiError(c, 400, 'validation_failed', 'Invalid request', {
      category_id: 'Unknown category',
    });
  }
  const now = new Date().toISOString();
  let id: number;
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO products (category_id, name, slug, description, tags, mrp_paise, price_paise, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        data.category_id,
        data.name,
        data.slug,
        data.description,
        data.tags.toLowerCase(),
        data.mrp_paise,
        data.price_paise,
        data.is_active ? 1 : 0,
        now,
        now,
      )
      .run();
    id = result.meta.last_row_id;
  } catch (err) {
    return dbWriteError(c, err, 'insert');
  }
  const product = (await loadAdminProducts(c.env.DB, [(await loadProductRow(c.env.DB, id))!]))[0]!;
  await purgePublicCache(clientOrigin(c.req.raw), [data.slug]);
  return c.json({ product }, 201);
});

/** PUT /api/admin/products/:id: partial. Purges old and new slug. */
productsRoutes.put('/products/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id === null ? null : await loadProductRow(c.env.DB, id);
  if (id === null || existing === null) return apiError(c, 404, 'not_found', 'Product not found');

  const parsed = await parseJson(c, (v) => ProductUpdateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;

  const mrp = data.mrp_paise ?? existing.mrp_paise;
  const price = data.price_paise ?? existing.price_paise;
  if (price > mrp) {
    return apiError(c, 400, 'validation_failed', 'Invalid request', {
      price_paise: 'price_paise must not exceed mrp_paise',
    });
  }
  if (data.category_id !== undefined && !(await categoryExists(c.env.DB, data.category_id))) {
    return apiError(c, 400, 'validation_failed', 'Invalid request', {
      category_id: 'Unknown category',
    });
  }

  const sets: string[] = [];
  const binds: (string | number)[] = [];
  const set = (column: string, value: string | number | undefined) => {
    if (value === undefined) return;
    sets.push(`${column} = ?`);
    binds.push(value);
  };
  set('category_id', data.category_id);
  set('name', data.name);
  set('slug', data.slug);
  set('description', data.description);
  set('tags', data.tags?.toLowerCase());
  set('mrp_paise', data.mrp_paise);
  set('price_paise', data.price_paise);
  set('is_active', data.is_active === undefined ? undefined : data.is_active ? 1 : 0);

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    binds.push(new Date().toISOString(), id);
    try {
      await c.env.DB.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`)
        .bind(...binds)
        .run();
    } catch (err) {
      return dbWriteError(c, err, 'insert');
    }
  }

  const updated = await loadProductRow(c.env.DB, id);
  const product = (await loadAdminProducts(c.env.DB, [updated!]))[0]!;
  await purgePublicCache(clientOrigin(c.req.raw), [existing.slug, product.slug]);
  return c.json({ product });
});

/** DELETE /api/admin/products/:id: removes the product's R2 objects first, then the row (FK cascade). */
productsRoutes.delete('/products/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const slug = id === null ? null : await productSlug(c.env.DB, id);
  if (id === null || slug === null) return apiError(c, 404, 'not_found', 'Product not found');

  const images = await c.env.DB.prepare(
    'SELECT r2_key, thumb_r2_key FROM product_images WHERE product_id = ?',
  )
    .bind(id)
    .all<{ r2_key: string; thumb_r2_key: string }>();
  for (const image of images.results) {
    await c.env.IMAGES.delete([image.r2_key, image.thumb_r2_key]);
  }

  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  await purgePublicCache(clientOrigin(c.req.raw), [slug]);
  return c.body(null, 204);
});

/** POST /api/admin/products/:id/images: links two keys already uploaded. 409 if either object is missing. */
productsRoutes.post('/products/:id/images', async (c) => {
  const id = parseId(c.req.param('id'));
  const slug = id === null ? null : await productSlug(c.env.DB, id);
  if (id === null || slug === null) return apiError(c, 404, 'not_found', 'Product not found');

  const parsed = await parseJson(c, (v) => ImageCreateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;

  const fullKeyProduct = data.full_r2_key.split('/')[1];
  const thumbKeyProduct = data.thumb_r2_key.split('/')[1];
  if (fullKeyProduct !== String(id) || thumbKeyProduct !== String(id)) {
    return apiError(c, 400, 'validation_failed', 'Image keys belong to another product');
  }

  const [full, thumb] = await Promise.all([
    c.env.IMAGES.head(data.full_r2_key),
    c.env.IMAGES.head(data.thumb_r2_key),
  ]);
  if (full === null || thumb === null) {
    return apiError(c, 409, 'conflict', 'Upload both image objects before linking them');
  }

  let imageId: number;
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO product_images (product_id, r2_key, thumb_r2_key, alt_text, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, data.full_r2_key, data.thumb_r2_key, data.alt_text, data.sort_order)
      .run();
    imageId = result.meta.last_row_id;
  } catch (err) {
    return dbWriteError(c, err, 'insert');
  }

  await purgePublicCache(clientOrigin(c.req.raw), [slug]);
  const image = toImageDto({
    id: imageId,
    product_id: id,
    r2_key: data.full_r2_key,
    thumb_r2_key: data.thumb_r2_key,
    alt_text: data.alt_text,
    sort_order: data.sort_order,
  });
  return c.json({ image }, 201);
});

/** DELETE /api/admin/products/:id/images/:imageId: removes the row, then both R2 objects. */
productsRoutes.delete('/products/:id/images/:imageId', async (c) => {
  const id = parseId(c.req.param('id'));
  const imageId = parseId(c.req.param('imageId'));
  const slug = id === null ? null : await productSlug(c.env.DB, id);
  if (id === null || imageId === null || slug === null) {
    return apiError(c, 404, 'not_found', 'Image not found');
  }
  const image = await c.env.DB.prepare(
    'SELECT r2_key, thumb_r2_key FROM product_images WHERE id = ? AND product_id = ?',
  )
    .bind(imageId, id)
    .first<{ r2_key: string; thumb_r2_key: string }>();
  if (image === null) return apiError(c, 404, 'not_found', 'Image not found');

  await c.env.DB.prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?')
    .bind(imageId, id)
    .run();
  await c.env.IMAGES.delete([image.r2_key, image.thumb_r2_key]);
  await purgePublicCache(clientOrigin(c.req.raw), [slug]);
  return c.body(null, 204);
});
