// Checkout validation. Uses the shared CreateOrderSchema so the browser and the Worker agree on the rules.
import { CreateOrderSchema } from '@beauty-store/shared';
import { t } from '../../i18n';
import type { CartLine } from '../../cart';

export interface CustomerForm {
  name: string;
  phone: string;
  address: string;
}

export type CheckoutField = 'name' | 'phone' | 'address' | 'items';
export type FieldErrors = Partial<Record<CheckoutField, string>>;

export type CheckoutResult =
  { ok: true; payload: CreateOrderPayload } | { ok: false; errors: FieldErrors };

/** Body for POST /api/orders. Carries identifiers and quantities only; the server prices the order. */
export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  address: string;
  items: { product_id: number; variant_id: number; qty: number }[];
}

/** Maps a schema or server field name (e.g. "customer_phone") to a form field. */
export function fieldForPath(path: string): CheckoutField {
  if (path.startsWith('customer_name')) return 'name';
  if (path.startsWith('customer_phone')) return 'phone';
  if (path.startsWith('address')) return 'address';
  return 'items';
}

/** English message for a form field, from en.ts. */
export function fieldMessage(field: CheckoutField): string {
  switch (field) {
    case 'name':
      return t('storefront.cart.errors.name');
    case 'phone':
      return t('storefront.cart.errors.phone');
    case 'address':
      return t('storefront.cart.errors.address');
    case 'items':
      return t('storefront.cart.errors.items');
  }
}

/** Validates the form and cart with CreateOrderSchema. Field messages come from en.ts. */
export function validateCheckout(form: CustomerForm, lines: readonly CartLine[]): CheckoutResult {
  const parsed = CreateOrderSchema.safeParse({
    customer_name: form.name,
    customer_phone: form.phone,
    address: form.address,
    items: lines.map((line) => ({
      product_id: line.productId,
      variant_id: line.variantId,
      qty: line.qty,
    })),
  });
  if (parsed.success) {
    return { ok: true, payload: parsed.data };
  }
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = fieldForPath(String(issue.path[0] ?? 'items'));
    errors[field] ??= fieldMessage(field);
  }
  return { ok: false, errors };
}
