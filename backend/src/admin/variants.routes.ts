import { Hono } from 'hono';
import { VariantCreateSchema, VariantUpdateSchema } from '@beauty-store/shared';
import { apiError } from '../http/errors';
import { purgePublicCache } from '../cache/purge';
import { clientOrigin } from './origin';
import { dbWriteError, parseId, parseJson, toVariantDto, type VariantRow } from './data';
import type { AdminEnv } from './middleware';

const VARIANT_COLUMNS = 'v.id, v.product_id, v.size, v.colour, v.sku, v.stock';

async function variantWithSlug(
  db: D1Database,
  id: number,
): Promise<(VariantRow & { slug: string }) | null> {
  return db
    .prepare(
      `SELECT ${VARIANT_COLUMNS}, p.slug FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`,
    )
    .bind(id)
    .first<VariantRow & { slug: string }>();
}

export const variantsRoutes = new Hono<AdminEnv>();

/** POST /api/admin/products/:id/variants: 409 on duplicate size+colour or sku. */
variantsRoutes.post('/products/:id/variants', async (c) => {
  const productId = parseId(c.req.param('id'));
  const product =
    productId === null
      ? null
      : await c.env.DB.prepare('SELECT slug FROM products WHERE id = ?')
          .bind(productId)
          .first<{ slug: string }>();
  if (productId === null || product === null) {
    return apiError(c, 404, 'not_found', 'Product not found');
  }

  const parsed = await parseJson(c, (v) => VariantCreateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;

  let id: number;
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO product_variants (product_id, size, colour, sku, stock) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(productId, data.size, data.colour, data.sku, data.stock)
      .run();
    id = result.meta.last_row_id;
  } catch (err) {
    return dbWriteError(c, err, 'insert');
  }
  await purgePublicCache(clientOrigin(c.req.raw), [product.slug]);
  const variant = toVariantDto({
    id,
    product_id: productId,
    size: data.size,
    colour: data.colour,
    sku: data.sku,
    stock: data.stock,
  });
  return c.json({ variant }, 201);
});

/** PUT /api/admin/variants/:id: partial, includes stock. */
variantsRoutes.put('/variants/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id === null ? null : await variantWithSlug(c.env.DB, id);
  if (id === null || existing === null) return apiError(c, 404, 'not_found', 'Variant not found');

  const parsed = await parseJson(c, (v) => VariantUpdateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;

  const sets: string[] = [];
  const binds: (string | number)[] = [];
  for (const [column, value] of [
    ['size', data.size],
    ['colour', data.colour],
    ['sku', data.sku],
    ['stock', data.stock],
  ] as const) {
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      binds.push(value);
    }
  }
  if (sets.length > 0) {
    try {
      await c.env.DB.prepare(`UPDATE product_variants SET ${sets.join(', ')} WHERE id = ?`)
        .bind(...binds, id)
        .run();
    } catch (err) {
      return dbWriteError(c, err, 'insert');
    }
  }

  const row = await c.env.DB.prepare(
    'SELECT id, product_id, size, colour, sku, stock FROM product_variants WHERE id = ?',
  )
    .bind(id)
    .first<VariantRow>();
  await purgePublicCache(clientOrigin(c.req.raw), [existing.slug]);
  return c.json({ variant: toVariantDto(row!) });
});

/** DELETE /api/admin/variants/:id */
variantsRoutes.delete('/variants/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id === null ? null : await variantWithSlug(c.env.DB, id);
  if (id === null || existing === null) return apiError(c, 404, 'not_found', 'Variant not found');
  await c.env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(id).run();
  await purgePublicCache(clientOrigin(c.req.raw), [existing.slug]);
  return c.body(null, 204);
});
