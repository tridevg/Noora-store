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
