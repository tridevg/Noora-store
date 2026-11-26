import { z } from 'zod';
import {
  IdSchema,
  PageSchema,
  PaiseSchema,
  PerPageSchema,
  SlugSchema,
  trimmedText,
} from './common';

/** GET /api/admin/products query (includes inactive products). */
export const AdminProductListQuerySchema = z.object({
  page: PageSchema,
  per_page: PerPageSchema,
  q: z.string().trim().max(100).optional(),
});

const ServiceFields = z.object({
  category_id: IdSchema,
  name: trimmedText(120),
  slug: SlugSchema,
  description: z.string().max(5000).default(''),
  price_paise: PaiseSchema,
  duration_minutes: z.number().int().positive().max(1440),
  is_active: z.boolean().default(true),
});

/** POST /api/admin/services */
export const ServiceCreateSchema = ServiceFields;

/** PUT /api/admin/services/:id (partial). */
export const ServiceUpdateSchema = ServiceFields.partial();

/** PUT /api/admin/settings: partial map of the five fixed keys; at least one key required. */
export const SettingsUpdateSchema = z
  .object({
    business_name: z.string().max(120),
    whatsapp_number: z.string().max(20),
    address: z.string().max(500),
    opening_hours: z.string().max(300),
    banner_text: z.string().max(200),
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'at least one setting is required' });

/** POST /api/admin/login */
export const LoginSchema = z
  .object({
    username: trimmedText(64),
    password: z.string().min(1).max(256),
  })
  .strict();

/** Response shapes for admin reads (Phase 4 additions). Mirror the DTOs in types.ts. */
const VariantDtoSchema = z.object({
  id: z.number().int(),
  product_id: z.number().int(),
  size: z.string(),
  colour: z.string(),
  sku: z.string(),
  stock: z.number().int().nonnegative(),
});

const ImageDtoSchema = z.object({
  id: z.number().int(),
  full_url: z.string(),
  thumb_url: z.string(),
  alt_text: z.string(),
  sort_order: z.number().int(),
});

/** AdminProductDto: includes inactive products, variants and images. */
export const AdminProductDtoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  category_id: z.number().int(),
  category_slug: z.string(),
  mrp_paise: PaiseSchema,
  price_paise: PaiseSchema,
  percent_off: z.number().int(),
  tags: z.string(),
  in_stock: z.boolean(),
  created_at: z.string(),
  thumb_url: z.string().nullable(),
  description: z.string(),
  variants: z.array(VariantDtoSchema),
  images: z.array(ImageDtoSchema),
  is_active: z.boolean(),
  updated_at: z.string(),
});

/** ServiceDto: includes inactive services and the category summary. */
export const AdminServiceDtoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  price_paise: PaiseSchema,
  duration_minutes: z.number().int().positive(),
  is_active: z.boolean(),
  category: z.object({ id: z.number().int(), name: z.string(), slug: z.string() }),
});

/** GET /api/admin/products/:id */
export const AdminProductResponseSchema = z.object({ product: AdminProductDtoSchema });

/** GET /api/admin/services */
export const AdminServicesResponseSchema = z.object({ services: z.array(AdminServiceDtoSchema) });

/** GET /api/admin/services/:id */
export const AdminServiceResponseSchema = z.object({ service: AdminServiceDtoSchema });
