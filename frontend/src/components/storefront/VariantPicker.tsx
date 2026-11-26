import type { VariantDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { fill } from './errorMessage';

export interface VariantChoice {
  size: string;
  colour: string;
}

interface VariantPickerProps {
  variants: readonly VariantDto[];
  value: VariantChoice;
  onChange: (next: VariantChoice) => void;
}

const LOW_STOCK_THRESHOLD = 3;

/** Distinct values in first-seen order. */
function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Size and colour selectors. Choosing a size that has no variant in the chosen colour (or the
 * reverse) moves the other selector to the first available match. Stock shown below reflects
 * the chosen combination.
 */
export function VariantPicker({ variants, value, onChange }: VariantPickerProps) {
  const sizes = unique(variants.map((v) => v.size));
  const colours = unique(variants.map((v) => v.colour));
  const find = (size: string, colour: string) =>
    variants.find((v) => v.size === size && v.colour === colour);
  const selected = find(value.size, value.colour);

  function chooseSize(size: string) {
    if (find(size, value.colour)) return onChange({ size, colour: value.colour });
    const fallback = variants.find((v) => v.size === size);
    if (fallback) onChange({ size, colour: fallback.colour });
  }

  function chooseColour(colour: string) {
    if (find(value.size, colour)) return onChange({ size: value.size, colour });
    const fallback = variants.find((v) => v.colour === colour);
    if (fallback) onChange({ size: fallback.size, colour });
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-small font-medium text-ink-primary">
          {t('storefront.product.size')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => {
            const available = variants.some((v) => v.size === size);
            const active = size === value.size;
            return (
              <button
                key={size}
                type="button"
                disabled={!available}
                aria-pressed={active}
                onClick={() => chooseSize(size)}
                className={`min-h-11 min-w-11 rounded-pill border px-4 text-small ${
                  active
                    ? 'border-sage-hover bg-sage-hover text-white'
                    : 'border-border-subtle bg-canvas text-ink-primary'
                } disabled:opacity-40`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-small font-medium text-ink-primary">
          {t('storefront.product.colour')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {colours.map((colour) => {
            const available = variants.some((v) => v.colour === colour);
            const active = colour === value.colour;
            return (
              <button
                key={colour}
                type="button"
                disabled={!available}
                aria-pressed={active}
                onClick={() => chooseColour(colour)}
                className={`min-h-11 rounded-pill border px-4 text-small ${
                  active
                    ? 'border-sage-hover bg-sage-hover text-white'
                    : 'border-border-subtle bg-canvas text-ink-primary'
                } disabled:opacity-40`}
              >
                {colour}
              </button>
            );
          })}
        </div>
      </fieldset>

      <StockLine variant={selected} />
    </div>
  );
}

function StockLine({ variant }: { variant: VariantDto | undefined }) {
  if (!variant) {
    return (
      <p role="status" className="text-small text-ink-muted">
        {t('storefront.product.unavailable')}
      </p>
    );
  }
  if (variant.stock <= 0) {
    return (
      <p role="status" className="text-small font-medium text-danger">
        {t('storefront.product.soldOut')}
      </p>
    );
  }
  const low = variant.stock <= LOW_STOCK_THRESHOLD;
  return (
    <p
      role="status"
      className={`text-small font-medium ${low ? 'text-sage-hover' : 'text-ink-primary'}`}
    >
      {low
        ? fill(t('storefront.product.lowStock'), { count: variant.stock })
        : t('storefront.product.inStock')}
    </p>
  );
}

/** The variant for a choice, or undefined when that combination does not exist. */
export function findVariant(variants: readonly VariantDto[], choice: VariantChoice) {
  return variants.find((v) => v.size === choice.size && v.colour === choice.colour);
}

/** First variant that is in stock, else the first variant. Undefined when there are none. */
export function defaultChoice(variants: readonly VariantDto[]): VariantChoice | undefined {
  const pick = variants.find((v) => v.stock > 0) ?? variants[0];
  return pick ? { size: pick.size, colour: pick.colour } : undefined;
}
