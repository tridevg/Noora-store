import { MAX_LINE_QTY } from '../../cart';
import { t } from '../../i18n';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Upper bound, never above the cart's per-line cap. */
  max?: number;
}

/** − / + control with a disabled state at the bounds. Removing a line is a separate control. */
export function QuantityStepper({ value, onChange, max = MAX_LINE_QTY }: QuantityStepperProps) {
  const limit = Math.min(max, MAX_LINE_QTY);
  return (
    <div className="inline-flex items-center rounded-pill border border-border bg-surface-raised">
      <button
        type="button"
        aria-label={t('storefront.cart.decrease')}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="size-11 text-lg text-ink disabled:opacity-40"
      >
        −
      </button>
      <output
        aria-label={t('storefront.cart.quantity')}
        className="min-w-8 text-center text-small font-medium"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={t('storefront.cart.increase')}
        disabled={value >= limit}
        onClick={() => onChange(value + 1)}
        className="size-11 text-lg text-ink disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
