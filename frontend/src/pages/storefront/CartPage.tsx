import type { InputHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { formatPaise } from '@beauty-store/shared';
import { t } from '../../i18n';
import { lineTotalPaise, type CartLine } from '../../cart';
import { fill } from '../../components/storefront/errorMessage';
import { Notice } from '../../components/storefront/Notice';
import { QuantityStepper } from '../../components/storefront/QuantityStepper';
import { useCheckout } from '../../components/storefront/useCheckout';
import { buttonClass } from '../../components/ui/Button';

const FIELD_CLASS =
  'min-h-11 w-full rounded-[1.25rem] border border-border-subtle bg-canvas px-3 font-ui text-body text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover';

/** /cart: the full-page version of the bag. Same checkout as the drawer, for direct links and no-JS-drawer use. */
export default function CartPage() {
  const checkout = useCheckout();
  const {
    lines,
    subtotalPaise,
    form,
    setForm,
    errors,
    formError,
    submitting,
    placed,
    numberReady,
    settings,
    submit,
  } = checkout;

  if (placed) {
    return (
      <section aria-labelledby="placed-title" className="mx-auto max-w-2xl space-y-5 py-6">
        <h1
          id="placed-title"
          className="font-display text-[2.6rem] leading-[1.05] font-medium text-ink-primary"
        >
          {fill(t('storefront.cart.placed'), { id: placed.id })}
        </h1>
        <p className="font-ui text-body text-ink-muted">{t('storefront.cart.placedBody')}</p>
        {placed.url ? (
          <a
            href={placed.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ size: 'lg' })}
          >
            {t('storefront.cart.reopenWhatsApp')}
          </a>
        ) : null}
        <p>
          <Link
            to="/products"
            className="font-ui text-small font-semibold text-sage-hover underline underline-offset-4"
          >
            {t('storefront.cart.continueShopping')}
          </Link>
        </p>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section aria-labelledby="cart-title" className="mx-auto max-w-2xl space-y-5 py-6">
        <h1
          id="cart-title"
          className="font-display text-[2.6rem] leading-[1.05] font-medium text-ink-primary"
        >
          {t('cart.title')}
        </h1>
        <Notice>
          {t('cart.empty')} {t('storefront.cart.emptyBody')}
        </Notice>
        <Link to="/products" className={buttonClass({ size: 'lg' })}>
          {t('storefront.cart.browse')}
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-8 py-4 md:grid-cols-[1fr_22rem]">
      <section aria-labelledby="cart-title" className="space-y-5">
        <h1
          id="cart-title"
          className="font-display text-[2.6rem] leading-[1.05] font-medium text-ink-primary"
        >
          {t('cart.title')}
        </h1>
        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {lines.map((line) => (
            <CartRow
              key={line.variantId}
              line={line}
              max={checkout.maxFor(line.variantId)}
              onQty={(qty) => checkout.setQty(line.variantId, qty)}
              onRemove={() => checkout.removeLine(line.variantId)}
            />
          ))}
        </ul>
        <p className="flex justify-between font-ui text-heading font-semibold text-ink-primary">
          <span>{t('storefront.cart.subtotal')}</span>
          <span>{formatPaise(subtotalPaise)}</span>
        </p>
        <Link
          to="/products"
          className="font-ui text-small font-semibold text-sage-hover underline underline-offset-4"
        >
          {t('storefront.cart.continueShopping')}
        </Link>
      </section>

      <section aria-labelledby="checkout-title">
        <form noValidate onSubmit={submit} className="space-y-4 rounded-[1.25rem] bg-sand p-5">
          <h2
            id="checkout-title"
            className="font-display text-[1.6rem] leading-tight font-medium text-ink-primary"
          >
            {t('storefront.cart.customerHeading')}
          </h2>
          <p className="font-ui text-small text-ink-muted">{t('storefront.cart.deliveryNote')}</p>

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
            <label htmlFor="cart-address" className="block font-ui text-small text-ink-muted">
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
            <p role="alert" className="font-ui text-small text-danger">
              {formError}
            </p>
          ) : null}
          {settings && !numberReady ? (
            <p className="font-ui text-small text-danger">{t('storefront.cart.numberMissing')}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !numberReady}
            className={buttonClass({ size: 'lg', className: 'w-full' })}
          >
            {submitting ? t('storefront.cart.placing') : t('storefront.cart.placeOrder')}
          </button>
        </form>
      </section>
    </div>
  );
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
    <li className="flex gap-4 py-4">
      <div className="min-w-0 flex-1 space-y-1">
        <Link
          to={`/product/${encodeURIComponent(line.slug)}`}
          className="font-ui font-medium text-ink-primary underline-offset-4 hover:underline"
        >
          {line.name}
        </Link>
        <p className="font-ui text-small text-ink-muted">
          {line.size} / {line.colour}
        </p>
        <p className="font-ui text-small text-ink-primary">{formatPaise(line.unitPricePaise)}</p>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 font-ui text-small font-semibold text-danger underline"
        >
          {t('storefront.cart.remove')}
        </button>
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        <QuantityStepper value={line.qty} max={max} onChange={onQty} />
        <p className="font-ui text-small font-semibold text-ink-primary">
          {formatPaise(lineTotalPaise(line))}
        </p>
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
      <label htmlFor={id} className="block font-ui text-small text-ink-muted">
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
    <p id={id} className="font-ui text-small text-danger">
      {message}
    </p>
  );
}
