import { describe, expect, it } from 'vitest';
import {
  CartItemSchema,
  CreateOrderSchema,
  LoginSchema,
  PaiseSchema,
  ProductCreateSchema,
  ProductListQuerySchema,
  ProductUpdateSchema,
  SettingsUpdateSchema,
  SlugSchema,
  VariantCreateSchema,
  OrderStatusUpdateSchema,
  OrderListQuerySchema,
  AdminProductListQuerySchema,
  ServiceCreateSchema,
  ServiceUpdateSchema,
  ImageUploadFieldsSchema,
  VariantUpdateSchema,
} from '../src/index';

const validOrder = {
  customer_name: 'Asha',
  customer_phone: '+91 98765 43210',
  address: '12 MG Road',
  items: [{ product_id: 1, variant_id: 2, qty: 1 }],
};

describe('PaiseSchema', () => {
  it('accepts integers and rejects decimals', () => {
    expect(PaiseSchema.safeParse(12).success).toBe(true);
    expect(PaiseSchema.safeParse(12.5).success).toBe(false);
    expect(PaiseSchema.safeParse(-1).success).toBe(false);
  });
});

describe('SlugSchema', () => {
  it('rejects slugs that are not lowercase kebab-case', () => {
    expect(SlugSchema.safeParse('silk-saree-red').success).toBe(true);
    expect(SlugSchema.safeParse('Bad Slug').success).toBe(false);
  });
});

describe('CreateOrderSchema', () => {
  it('accepts a cart with identifiers and quantity only', () => {
    expect(CreateOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it('rejects total_paise and other client-supplied prices', () => {
    expect(CreateOrderSchema.safeParse({ ...validOrder, total_paise: 100 }).success).toBe(false);
    expect(
      CreateOrderSchema.safeParse({
        ...validOrder,
        items: [{ product_id: 1, variant_id: 2, qty: 1, unit_price_paise: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe('CartItemSchema', () => {
  it('limits qty to 1..20', () => {
    const base = { product_id: 1, variant_id: 1 };
    expect(CartItemSchema.safeParse({ ...base, qty: 0 }).success).toBe(false);
    expect(CartItemSchema.safeParse({ ...base, qty: 20 }).success).toBe(true);
    expect(CartItemSchema.safeParse({ ...base, qty: 21 }).success).toBe(false);
  });
});

describe('ProductListQuerySchema', () => {
  it('rejects per_page above 48 and accepts 48', () => {
    expect(ProductListQuerySchema.safeParse({ per_page: '49' }).success).toBe(false);
    expect(ProductListQuerySchema.safeParse({ per_page: '48' }).success).toBe(true);
  });

  it('coerces in_stock from "1" to true', () => {
    const parsed = ProductListQuerySchema.parse({ in_stock: '1' });
    expect(parsed.in_stock).toBe(true);
  });
});

describe('product schemas', () => {
  const product = {
    category_id: 1,
    name: 'Kurti',
    slug: 'kurti-red',
    mrp_paise: 200000,
    price_paise: 150000,
  };

  it('rejects price above mrp on create and on partial update', () => {
    expect(ProductCreateSchema.safeParse({ ...product, price_paise: 300000 }).success).toBe(false);
    expect(ProductUpdateSchema.safeParse({ mrp_paise: 1000, price_paise: 2000 }).success).toBe(
      false,
    );
    expect(ProductUpdateSchema.safeParse({ name: 'Only name' }).success).toBe(true);
  });
});

describe('variant and image schemas', () => {
  it('validates variant create and partial update', () => {
    expect(
      VariantCreateSchema.safeParse({ size: 'M', colour: 'Red', sku: 'KUR-M-RED' }).success,
    ).toBe(true);
    expect(VariantUpdateSchema.safeParse({ stock: 5 }).success).toBe(true);
  });

  it('defaults image link fields and rejects a negative sort_order', () => {
    expect(ImageUploadFieldsSchema.parse({})).toEqual({ alt_text: '', sort_order: 0 });
    expect(ImageUploadFieldsSchema.safeParse({ sort_order: -1 }).success).toBe(false);
  });
});

describe('service and admin schemas', () => {
  it('validates service create and update', () => {
    expect(
      ServiceCreateSchema.safeParse({
        category_id: 3,
        name: 'Facial',
        slug: 'facial',
        price_paise: 99900,
        duration_minutes: 60,
      }).success,
    ).toBe(true);
    expect(ServiceUpdateSchema.safeParse({ duration_minutes: 0 }).success).toBe(false);
  });

  it('validates order status, order list, admin product list and login', () => {
    expect(OrderStatusUpdateSchema.safeParse({ status: 'shipped' }).success).toBe(false);
    expect(OrderListQuerySchema.safeParse({ status: 'new' }).success).toBe(true);
    expect(AdminProductListQuerySchema.safeParse({ per_page: 49 }).success).toBe(false);
    expect(LoginSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false);
  });

  it('requires at least one setting in SettingsUpdateSchema', () => {
    expect(SettingsUpdateSchema.safeParse({}).success).toBe(false);
    expect(SettingsUpdateSchema.safeParse({ banner_text: 'Sale' }).success).toBe(true);
  });
});
