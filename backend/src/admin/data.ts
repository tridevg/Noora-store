import type { Context } from 'hono';
import type {
  ImageDto,
  OrderDto,
  OrderItemDto,
  OrderStatus,
  VariantDto,
} from '@beauty-store/shared';
import { apiError, issueFields } from '../http/errors';
import type { AdminEnv } from './middleware';

type Issue = { path: PropertyKey[]; message: string };
type ParseResult<T> = { success: true; data: T } | { success: false; error: { issues: Issue[] } };

/** Parses the JSON body with a schema's safeParse. Bad JSON and schema failures return a 400 response. */
export async function parseJson<T>(
  c: Context<AdminEnv>,
  parse: (value: unknown) => ParseResult<T>,
): Promise<{ data: T } | { response: Response }> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { response: apiError(c, 400, 'validation_failed', 'Request body must be JSON') };
  }
  const parsed = parse(body);
  if (!parsed.success) {
    return {
      response: apiError(
        c,
        400,
        'validation_failed',
        'Invalid request',
        issueFields(parsed.error.issues),
      ),
    };
  }
  return { data: parsed.data };
}

/** Parses a positive integer route parameter. Anything else is treated as not found. */
export function parseId(raw: string | undefined): number | null {
  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/** Escapes LIKE wildcards so user text matches literally. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export function imageUrl(key: string): string {
  return `/images/${key}`;
}

/** Maps a D1 write failure to a 4xx response, or rethrows so the global handler returns 500. */
export function dbWriteError(
  c: Context<AdminEnv>,
  err: unknown,
  mode: 'insert' | 'delete',
): Response {
  const message = err instanceof Error ? err.message : String(err);
  if (/UNIQUE constraint failed/i.test(message)) {
    return apiError(c, 409, 'conflict', uniqueMessage(message));
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    if (mode === 'delete') {
      return apiError(c, 409, 'conflict', 'Record is still referenced by other data');
    }
    return apiError(c, 400, 'validation_failed', 'Referenced record does not exist');
  }
  if (/CHECK constraint failed/i.test(message)) {
    return apiError(c, 400, 'validation_failed', 'Value violates a database constraint');
  }
  throw err;
}

function uniqueMessage(message: string): string {
  if (message.includes('products.slug')) return 'Product slug already in use';
  if (message.includes('services.slug')) return 'Service slug already in use';
  if (message.includes('product_variants.sku')) return 'SKU already in use';
  if (message.includes('product_variants.size'))
    return 'Size and colour already exist for this product';
  if (message.includes('product_images.r2_key')) return 'Image key already linked';
  return 'Duplicate value';
}

export interface VariantRow {
  id: number;
  product_id: number;
  size: string;
  colour: string;
  sku: string;
  stock: number;
}

export function toVariantDto(row: VariantRow): VariantDto {
  return {
    id: row.id,
    product_id: row.product_id,
    size: row.size,
    colour: row.colour,
    sku: row.sku,
    stock: row.stock,
  };
}

export interface ImageRow {
  id: number;
  product_id: number;
  r2_key: string;
  thumb_r2_key: string;
  alt_text: string;
  sort_order: number;
}

export function toImageDto(row: ImageRow): ImageDto {
  return {
    id: row.id,
    full_url: imageUrl(row.r2_key),
    thumb_url: imageUrl(row.thumb_r2_key),
    alt_text: row.alt_text,
    sort_order: row.sort_order,
  };
}

export interface OrderRow {
  id: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  items_json: string;
  total_paise: number;
  status: OrderStatus;
  created_at: string;
}

export function toOrderDto(row: OrderRow): OrderDto {
  return {
    id: row.id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    address: row.address,
    items: JSON.parse(row.items_json) as OrderItemDto[],
    total_paise: row.total_paise,
    status: row.status,
    created_at: row.created_at,
  };
}

export const ORDER_COLUMNS =
  'id, customer_name, customer_phone, address, items_json, total_paise, status, created_at';
