import { z } from 'zod';
import { IdSchema, PageSchema, PerPageSchema, trimmedText } from './common';

export const OrderStatusSchema = z.enum(['new', 'confirmed', 'delivered', 'cancelled']);

/** One cart line: identifiers and quantity only. The server reads prices from D1. */
export const CartItemSchema = z
  .object({
    product_id: IdSchema,
    variant_id: IdSchema,
    qty: z.number().int().min(1).max(20),
  })
  .strict();

/**
 * POST /api/orders. Strict: rejects price_paise, total_paise and unit_price_paise
 * at the top level and inside items.
 */
export const CreateOrderSchema = z
  .object({
    customer_name: trimmedText(80),
    customer_phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 -]{8,20}$/, 'invalid phone number'),
    address: trimmedText(500),
    items: z.array(CartItemSchema).min(1).max(50),
  })
  .strict();

/** PATCH /api/admin/orders/:id/status */
export const OrderStatusUpdateSchema = z.object({ status: OrderStatusSchema }).strict();

/** GET /api/admin/orders query. */
export const OrderListQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
  page: PageSchema,
  per_page: PerPageSchema,
});
