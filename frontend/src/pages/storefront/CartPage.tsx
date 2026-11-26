import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { formatPaise } from '@beauty-store/shared';
import { t } from '../../i18n';
import { lineTotalPaise, useCart, type CartLine } from '../../cart';
import { errorMessage, fill } from '../../components/storefront/errorMessage';
import { Notice } from '../../components/storefront/Notice';
import { QuantityStepper } from '../../components/storefront/QuantityStepper';
import { buildOrderWhatsAppUrl } from '../../components/storefront/orderWhatsApp';
import {
  describeLine,
  linesOverStock,
  maxQtyForStock,
  orderConflictMessage,
} from '../../components/storefront/stockCap';
import { useCartStock } from '../../components/storefront/useCartStock';
import {
  fieldForPath,
  fieldMessage,
  validateCheckout,
  type CustomerForm,
  type FieldErrors,
} from '../../components/storefront/checkout';
import { useSettings, whatsAppLink } from '../../components/storefront/useSettings';
import { apiPost, ApiError } from '../../lib/api';

interface OrderCreatedResponse {
  id: number;
  status: 'new';
  total_paise: number;
  items_count: number;
}

interface PlacedOrder {
  id: number;
  url: string | null;
}

const EMPTY_FORM: CustomerForm = { name: '', phone: '', address: '' };
const FIELD_CLASS =
  'min-h-11 w-full rounded-card border border-border bg-surface-raised px-3 text-ink';

/** /cart: quantities, customer form (Zod-validated), and the order hand-off to WhatsApp. */
export default function CartPage() {
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

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
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

  if (placed) {
    return (
      <section aria-labelledby="placed-title" className="space-y-4 py-2">
        <h1 id="placed-title" className="text-display font-semibold text-ink">
          {fill(t('storefront.cart.placed'), { id: placed.id })}
        </h1>
        <p className="text-body text-muted">{t('storefront.cart.placedBody')}</p>
        {placed.url ? (
          <a
            href={placed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center rounded-pill bg-accent px-6 font-semibold text-accent-ink"
          >
            {t('storefront.cart.reopenWhatsApp')}
          </a>
        ) : null}
        <p>
          <Link to="/products" className="text-small font-medium text-accent underline">
            {t('storefront.cart.continueShopping')}
          </Link>
        </p>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section aria-labelledby="cart-title" className="space-y-4 py-2">
        <h1 id="cart-title" className="text-display font-semibold text-ink">
          {t('cart.title')}
        </h1>
        <Notice>
          {t('cart.empty')} {t('storefront.cart.emptyBody')}
        </Notice>
        <Link
          to="/products"
          className="inline-flex min-h-11 items-center rounded-pill bg-accent px-6 font-semibold text-accent-ink"
        >
          {t('storefront.cart.browse')}
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-8 py-2 md:grid-cols-[1fr_22rem]">
      <section aria-labelledby="cart-title" className="space-y-4">
        <h1 id="cart-title" className="text-display font-semibold text-ink">
          {t('cart.title')}
        </h1>
        <ul className="divide-y divide-border rounded-card bg-surface-raised shadow-card">
          {lines.map((line) => (
            <CartRow
              key={line.variantId}
              line={line}
              max={maxQtyForStock(stock.get(line.variantId))}
              onQty={(qty) => setQty(line.variantId, qty)}
              onRemove={() => removeLine(line.variantId)}
            />
          ))}
        </ul>
        <p className="flex justify-between text-heading font-semibold text-ink">
          <span>{t('storefront.cart.subtotal')}</span>
          <span>{formatPaise(subtotalPaise)}</span>
        </p>
        <Link to="/products" className="text-small font-medium text-accent underline">
          {t('storefront.cart.continueShopping')}
        </Link>
      </section>

      <section aria-labelledby="checkout-title" className="space-y-4">
        <form
          noValidate
          onSubmit={placeOrder}
          className="space-y-4 rounded-card bg-surface-raised p-4 shadow-card"
        >
          <h2 id="checkout-title" className="text-heading font-semibold text-ink">
            {t('storefront.cart.customerHeading')}
          </h2>
          <p className="text-small text-muted">{t('storefront.cart.deliveryNote')}</p>

          <Field
            id="cart-name"
            label={t('storefront.cart.nameLabel')}
            error={errors.name}
            autoComplete="name"
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <Field
            id="cart-phone"
            label={t('storefront.cart.phoneLabel')}
            error={errors.phone}
            autoComplete="tel"
            inputMode="tel"
            type="tel"
            value={form.phone}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
          <div className="space-y-1">
            <label htmlFor="cart-address" className="block text-small text-muted">
              {t('storefront.cart.addressLabel')}
            </label>
            <textarea
              id="cart-address"
              rows={3}
              autoComplete="street-address"
              aria-invalid={errors.address ? true : undefined}
              aria-describedby={errors.address ? 'cart-address-error' : undefined}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className={`${FIELD_CLASS} py-2`}
            />
            {errors.address ? (
              <FieldError id="cart-address-error" message={errors.address} />
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="text-small text-danger">
              {formError}
            </p>
          ) : null}
          {settings && !numberReady ? (
            <p className="text-small text-danger">{t('storefront.cart.numberMissing')}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !numberReady}
            className="min-h-12 w-full rounded-pill bg-accent px-6 font-semibold text-accent-ink disabled:opacity-40"
          >
            {submitting ? t('storefront.cart.placing') : t('storefront.cart.placeOrder')}
          </button>
        </form>
      </section>
    </div>
  );
}

/** Opens the WhatsApp hand-off in a new tab; falls back to the same tab when pop-ups are blocked. */
function openWhatsApp(url: string) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(url);
}

function CartRow({
  line,
  max,
  onQty,
  onRemove,
}: {
  line: CartLine;
  max: number;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex gap-3 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <Link
          to={`/product/${encodeURIComponent(line.slug)}`}
          className="font-medium text-ink hover:underline"
        >
          {line.name}
        </Link>
        <p className="text-small text-muted">
          {line.size} / {line.colour}
        </p>
        <p className="text-small text-ink">{formatPaise(line.unitPricePaise)}</p>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 text-small font-medium text-danger underline"
        >
          {t('storefront.cart.remove')}
        </button>
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        <QuantityStepper value={line.qty} max={max} onChange={onQty} />
        <p className="text-small font-semibold text-ink">{formatPaise(lineTotalPaise(line))}</p>
      </div>
    </li>
  );
}

function Field({
  id,
  label,
  error,
  value,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  error: string | undefined;
  value: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'>) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-small text-muted">
        {label}
      </label>
      <input
        {...input}
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      />
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="text-small text-danger">
      {message}
    </p>
  );
}
