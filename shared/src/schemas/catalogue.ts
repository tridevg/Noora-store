import { z } from 'zod';
import {
  IdSchema,
  PageSchema,
  PaiseSchema,
  PerPageSchema,
  SlugSchema,
  trimmedText,
} from './common';

export const ProductSortSchema = z.enum(['newest', 'price_asc', 'price_desc', 'popularity']);

/** GET /api/products query. per_page max 48. */
export const ProductListQuerySchema = z.object({
  category: SlugSchema.optional(),
  q: z.string().trim().max(100).optional(),
  min_price: PaiseSchema.optional(),
  max_price: PaiseSchema.optional(),
  size: z.string().trim().max(20).optional(),
  colour: z.string().trim().max(40).optional(),
  in_stock: z
    .enum(['0', '1'])
    .transform((v) => v === '1')
    .optional(),
  sort: ProductSortSchema.optional(),
  page: PageSchema,
  per_page: PerPageSchema,
});

const ProductFields = z.object({
  category_id: IdSchema,
  name: trimmedText(120),
  slug: SlugSchema,
  description: z.string().max(5000).default(''),
  tags: z.string().max(300).default(''),
  mrp_paise: PaiseSchema,
  price_paise: PaiseSchema,
  is_active: z.boolean().default(true),
});

/** POST /api/admin/products. Price cannot exceed MRP. */
export const ProductCreateSchema = ProductFields.refine((d) => d.price_paise <= d.mrp_paise, {
  message: 'price_paise must not exceed mrp_paise',
  path: ['price_paise'],
});

/** PUT /api/admin/products/:id. Partial; price rule applies when both values are sent. */
export const ProductUpdateSchema = ProductFields.partial().refine(
  (d) => d.price_paise === undefined || d.mrp_paise === undefined || d.price_paise <= d.mrp_paise,
  { message: 'price_paise must not exceed mrp_paise', path: ['price_paise'] },
);

const VariantFields = z.object({
  size: trimmedText(20),
  colour: trimmedText(40),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'sku may contain letters, digits, "-" and "_" only'),
  stock: z.number().int().nonnegative().default(0),
});

/** POST /api/admin/products/:id/variants */
export const VariantCreateSchema = VariantFields;

/** PUT /api/admin/variants/:id (partial, includes stock). */
export const VariantUpdateSchema = VariantFields.partial();

/**
 * POST /api/admin/products/:id/images is multipart/form-data: `full` and `thumb` file parts
 * (image/webp or image/jpeg) plus these text fields. The Worker stores both blobs and the link
 * in one D1 batch and generates the keys itself.
 */
export const ImageUploadFieldsSchema = z.object({
  alt_text: z.string().max(200).default(''),
  sort_order: z.number().int().nonnegative().default(0),
});
