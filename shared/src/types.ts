// Response DTOs shared by backend and frontend. Money fields are integer paise.

export type CategoryType = 'product' | 'service';

export type OrderStatus = 'new' | 'confirmed' | 'delivered' | 'cancelled';

export type SettingKey =
  'business_name' | 'whatsapp_number' | 'address' | 'opening_hours' | 'banner_text';

export type SettingsMap = Record<SettingKey, string>;

export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
  type: CategoryType;
  sort_order: number;
}

export interface VariantDto {
  id: number;
  product_id: number;
  size: string;
  colour: string;
  sku: string;
  stock: number;
}

export interface ImageDto {
  id: number;
  full_url: string;
  thumb_url: string;
  alt_text: string;
  sort_order: number;
}

export interface ProductSummaryDto {
  id: number;
  name: string;
  slug: string;
  category_slug: string;
  mrp_paise: number;
  price_paise: number;
  percent_off: number;
  tags: string;
  in_stock: boolean;
  created_at: string;
  thumb_url: string | null;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string;
  variants: VariantDto[];
  images: ImageDto[];
}

export interface AdminProductDto extends ProductDetailDto {
  category_id: number;
  is_active: boolean;
  updated_at: string;
}

export interface ServiceDto {
  id: number;
  name: string;
  slug: string;
  description: string;
  price_paise: number;
  duration_minutes: number;
  is_active: boolean;
  category: { id: number; name: string; slug: string };
}

export interface OrderItemDto {
  product_id: number;
  variant_id: number;
  name: string;
  size: string;
  colour: string;
  qty: number;
  unit_price_paise: number;
}

export interface OrderDto {
  id: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  items: OrderItemDto[];
  total_paise: number;
  status: OrderStatus;
  created_at: string;
}

export interface DashboardDto {
  counts: Record<OrderStatus, number>;
  recent_orders: OrderDto[];
}

export type ErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'csrf_failed'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}
