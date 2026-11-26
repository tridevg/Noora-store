import { MAX_LINE_QTY } from '../../cart';
import { t } from '../../i18n';
import { cn } from '../ui/cn';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Upper bound, never above the cart's per-line cap. */
  max?: number;
  tone?: 'light' | 'dark';
}

/** − / + control with a disabled state at the bounds. Removing a line is a separate control. */
export function QuantityStepper({
  value,
  onChange,
  max = MAX_LINE_QTY,
  tone = 'light',
}: QuantityStepperProps) {
  const limit = Math.min(max, MAX_LINE_QTY);
  const dark = tone === 'dark';
  const button = cn(
    'inline-flex size-11 items-center justify-center text-lg disabled:opacity-40',
    dark ? 'text-canvas hover:bg-drawer-line' : 'text-ink-primary hover:bg-sand',
  );
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-pill border',
        dark ? 'border-drawer-line bg-drawer-surface' : 'border-border-subtle bg-canvas',
      )}
    >
      <button
        type="button"
        aria-label={t('storefront.cart.decrease')}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={button}
      >
        −
      </button>
      <output
        aria-label={t('storefront.cart.quantity')}
        className="min-w-8 text-center font-ui text-small font-semibold"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={t('storefront.cart.increase')}
        disabled={value >= limit}
        onClick={() => onChange(value + 1)}
        className={button}
      >
        +
      </button>
    </div>
  );
}
