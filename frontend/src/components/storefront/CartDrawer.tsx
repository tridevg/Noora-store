import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { formatPaise, type ProductDetailDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { lineTotalPaise, type CartLine } from '../../cart';
import { apiGet } from '../../lib/api';
import { fill } from './errorMessage';
import { QuantityStepper } from './QuantityStepper';
import { useCheckout, type CheckoutState } from './useCheckout';
import { Button, buttonClass } from '../ui/Button';
import { Separator } from '../ui/Separator';
import { Sheet } from '../ui/Sheet';

const FIELD =
  'min-h-11 w-full rounded-card border border-drawer-line bg-drawer-surface px-3 font-ui text-body text-canvas placeholder:text-drawer-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas';

/** Thumbnail URL per product slug. The cart stores no image, so each slug is fetched once. */
function useCartThumbs(lines: readonly CartLine[]): Record<string, string | null> {
  const slugKey = [...new Set(lines.map((line) => line.slug))].sort().join('|');
  const [state, setState] = useState<{ key: string; map: Record<string, string | null> } | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    const slugs = slugKey ? slugKey.split('|') : [];
    void Promise.all(
      slugs.map(async (slug) => {
        try {
          const body = await apiGet<{ product: ProductDetailDto }>(
            `/api/products/${encodeURIComponent(slug)}`,
            controller.signal,
          );
          return [slug, body.product.images[0]?.thumb_url ?? null] as const;
        } catch {
          return [slug, null] as const;
        }
      }),
    ).then((entries) => {
      if (!controller.signal.aborted) {
        setState({ key: slugKey, map: Object.fromEntries(entries) });
      }
    });
    return () => controller.abort();
  }, [slugKey]);

  return state?.key === slugKey ? state.map : {};
}

/**
 * The bag: a dark right-hand drawer with the cart lines, the customer details and the WhatsApp
 * checkout. Opened from the header and from Add to Bag. The full /cart page is the fallback.
 */
export default function CartDrawer({ onClose }: { onClose: () => void }) {
  const checkout = useCheckout();
  const thumbs = useCartThumbs(checkout.lines);

  return (
    <Sheet open onClose={onClose} title={t('bag.title')} closeLabel={t('bag.close')} tone="dark">
      {checkout.placed ? (
        <PlacedBody checkout={checkout} onClose={onClose} />
      ) : checkout.lines.length === 0 ? (
        <div className="flex flex-1 flex-col gap-4 p-5">
          <p className="font-display text-[1.75rem] leading-tight text-canvas">
            {t('bag.emptyTitle')}
          </p>
          <p className="font-ui text-small text-drawer-muted">{t('bag.emptyBody')}</p>
          <Link to="/products" onClick={onClose} className={buttonClass({ variant: 'light' })}>
            {t('storefront.cart.browse')}
          </Link>
        </div>
      ) : (
        <BagForm checkout={checkout} thumbs={thumbs} onClose={onClose} />
      )}
    </Sheet>
  );
}

function BagForm({
  checkout,
  thumbs,
  onClose,
}: {
  checkout: CheckoutState;
  thumbs: Record<string, string | null>;
  onClose: () => void;
}) {
  const { lines, form, setForm, errors, formError, submitting, numberReady, settings, submit } =
    checkout;
  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <ul className="space-y-4">
          {lines.map((line) => (
            <li key={line.variantId} className="flex gap-3">
              <div className="size-20 shrink-0 overflow-hidden rounded-card bg-drawer-surface">
                {thumbs[line.slug] ? (
                  <img
                    src={thumbs[line.slug] ?? undefined}
                    alt=""
                    width={80}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-ui text-small font-semibold text-canvas">{line.name}</p>
                  <p className="font-ui text-small font-semibold text-canvas">
                    {formatPaise(lineTotalPaise(line))}
                  </p>
                </div>
                <p className="font-ui text-small text-drawer-muted">
                  {line.size} / {line.colour} · {formatPaise(line.unitPricePaise)}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <QuantityStepper
                    tone="dark"
                    value={line.qty}
                    max={checkout.maxFor(line.variantId)}
                    onChange={(qty) => checkout.setQty(line.variantId, qty)}
                  />
                  <button
                    type="button"
                    onClick={() => checkout.removeLine(line.variantId)}
                    className="min-h-11 font-ui text-small font-semibold text-drawer-muted underline underline-offset-4 hover:text-canvas"
                  >
                    {t('storefront.cart.remove')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Separator tone="dark" />

        <fieldset className="space-y-4">
          <legend className="mb-3 font-display text-[1.4rem] leading-tight text-canvas">
            {t('storefront.cart.customerHeading')}
          </legend>
          <p className="font-ui text-small text-drawer-muted">
            {t('storefront.cart.deliveryNote')}
          </p>
          <DrawerField
            id="bag-name"
            label={t('storefront.cart.nameLabel')}
            error={errors.name}
            autoComplete="name"
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <DrawerField
            id="bag-phone"
            label={t('storefront.cart.phoneLabel')}
            error={errors.phone}
            autoComplete="tel"
            inputMode="tel"
            type="tel"
            value={form.phone}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
          <div className="space-y-2">
            <label htmlFor="bag-address" className="block font-ui text-small text-drawer-muted">
              {t('storefront.cart.addressLabel')}
            </label>
            <textarea
              id="bag-address"
              rows={3}
              autoComplete="street-address"
              aria-invalid={errors.address ? true : undefined}
              aria-describedby={errors.address ? 'bag-address-error' : undefined}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className={`${FIELD} py-2`}
            />
            {errors.address ? (
              <p id="bag-address-error" className="font-ui text-small text-drawer-danger">
                {errors.address}
              </p>
            ) : null}
          </div>
        </fieldset>
      </div>

      <div className="space-y-4 border-t border-drawer-line p-5">
        <div className="flex items-baseline justify-between font-ui text-canvas">
          <span className="text-small">{t('storefront.cart.subtotal')}</span>
          <span className="text-heading font-semibold">{formatPaise(checkout.subtotalPaise)}</span>
        </div>
        {formError ? (
          <p role="alert" className="font-ui text-small text-drawer-danger">
            {formError}
          </p>
        ) : null}
        {settings && !numberReady ? (
          <p className="font-ui text-small text-drawer-danger">
            {t('storefront.cart.numberMissing')}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !numberReady}>
          {submitting ? t('storefront.cart.placing') : t('bag.checkout')}
        </Button>
        <Link
          to="/cart"
          onClick={onClose}
          className="block text-center font-ui text-small font-semibold text-canvas underline underline-offset-4"
        >
          {t('bag.viewFull')}
        </Link>
      </div>
    </form>
  );
}

function PlacedBody({ checkout, onClose }: { checkout: CheckoutState; onClose: () => void }) {
  const placed = checkout.placed;
  if (!placed) return null;
  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <p role="status" className="font-display text-[1.75rem] leading-tight text-canvas">
        {fill(t('storefront.cart.placed'), { id: placed.id })}
      </p>
      <p className="font-ui text-body text-drawer-muted">{t('storefront.cart.placedBody')}</p>
      {placed.url ? (
        <a
          href={placed.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: 'primary', size: 'lg' })}
        >
          {t('storefront.cart.reopenWhatsApp')}
        </a>
      ) : null}
      <Button variant="light" onClick={onClose}>
        {t('storefront.cart.continueShopping')}
      </Button>
    </div>
  );
}

function DrawerField({
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
    <div className="space-y-2">
      <label htmlFor={id} className="block font-ui text-small text-drawer-muted">
        {label}
      </label>
      <input
        {...input}
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD}
      />
      {error ? (
        <p id={errorId} className="font-ui text-small text-drawer-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
