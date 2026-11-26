// Checkout state shared by /cart and the bag drawer. The order goes to POST /api/orders, then the
// customer hands the order to the shop on WhatsApp (wa.me). Server contract is unchanged.
import { useState, type FormEvent } from 'react';
import type { SettingsMap } from '@beauty-store/shared';
import { useCart, type CartLine } from '../../cart';
import { ApiError, apiPost } from '../../lib/api';
import { errorMessage } from './errorMessage';
import { buildOrderWhatsAppUrl } from './orderWhatsApp';
import {
  describeLine,
  linesOverStock,
  maxQtyForStock,
  orderConflictMessage,
  type StockMap,
} from './stockCap';
import {
  fieldForPath,
  fieldMessage,
  validateCheckout,
  type CustomerForm,
  type FieldErrors,
} from './checkout';
import { useCartStock } from './useCartStock';
import { useSettings, whatsAppLink } from './useSettings';

interface OrderCreatedResponse {
  id: number;
  status: 'new';
  total_paise: number;
  items_count: number;
}

export interface PlacedOrder {
  id: number;
  url: string | null;
}

export const EMPTY_FORM: CustomerForm = { name: '', phone: '', address: '' };

/** Opens the WhatsApp hand-off in a new tab; falls back to the same tab when pop-ups are blocked. */
function openWhatsApp(url: string) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(url);
}

export interface CheckoutState {
  lines: CartLine[];
  subtotalPaise: number;
  stock: StockMap;
  maxFor: (variantId: number) => number;
  setQty: (variantId: number, qty: number) => void;
  removeLine: (variantId: number) => void;
  settings: SettingsMap | undefined;
  numberReady: boolean;
  form: CustomerForm;
  setForm: (next: CustomerForm) => void;
  errors: FieldErrors;
  formError: string | null;
  submitting: boolean;
  placed: PlacedOrder | null;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/** Cart, stock, customer form and the POST /api/orders then wa.me hand-off. */
export function useCheckout(): CheckoutState {
  const { lines, subtotalPaise, setQty, removeLine, clear } = useCart();
  const settings = useSettings();
  const { stock, refresh } = useCartStock(lines);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const numberReady = whatsAppLink(settings, '') !== null;
  const whatsappNumber = settings?.whatsapp_number ?? '';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const checked = validateCheckout(form, lines);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const order = await apiPost<OrderCreatedResponse>('/api/orders', checked.payload);
      let url: string | null = null;
      try {
        url = buildOrderWhatsAppUrl(whatsappNumber, {
          orderId: order.id,
          totalPaise: order.total_paise,
          customerName: form.name.trim(),
          customerPhone: form.phone.trim(),
          address: form.address.trim(),
          lines,
        });
      } catch {
        url = null;
      }
      if (url) openWhatsApp(url);
      setPlaced({ id: order.id, url });
      clear();
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // The cart is kept. Re-check stock so the message names the lines that are now short.
        const current = await refresh(lines).catch(() => null);
        const names = current ? linesOverStock(lines, current).map(describeLine) : [];
        setFormError(orderConflictMessage(error, names) ?? errorMessage(error));
        return;
      }
      if (error instanceof ApiError && error.code === 'validation_failed' && error.fields) {
        // Server field names map to form fields; messages come from en.ts, not the server.
        const next: FieldErrors = {};
        for (const path of Object.keys(error.fields)) {
          const field = fieldForPath(path);
          next[field] ??= fieldMessage(field);
        }
        setErrors(next);
      }
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    lines,
    subtotalPaise,
    stock,
    maxFor: (variantId) => maxQtyForStock(stock.get(variantId)),
    setQty,
    removeLine,
    settings,
    numberReady,
    form,
    setForm,
    errors,
    formError,
    submitting,
    placed,
    submit,
  };
}
