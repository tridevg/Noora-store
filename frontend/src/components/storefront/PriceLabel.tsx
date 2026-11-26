import { formatPaise, percentOff } from '@beauty-store/shared';
import { t } from '../../i18n';
import { fill } from './errorMessage';

interface PriceLabelProps {
  mrpPaise: number;
  pricePaise: number;
  size?: 'card' | 'detail';
}

/** Selling price, struck-through MRP and % OFF. Money is integer paise, formatted by the shared helper. */
export function PriceLabel({ mrpPaise, pricePaise, size = 'card' }: PriceLabelProps) {
  const off = percentOff(mrpPaise, pricePaise);
  const onSale = mrpPaise > pricePaise;
  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-2 ${size === 'detail' ? 'text-heading' : 'text-small'}`}
    >
      <span className="font-semibold text-ink">{formatPaise(pricePaise)}</span>
      {onSale ? (
        <>
          <span className="sr-only">{t('storefront.product.mrp')}</span>
          <s className="text-muted">{formatPaise(mrpPaise)}</s>
          <span className="font-medium text-accent">
            {fill(t('storefront.card.percentOff'), { percent: off })}
          </span>
        </>
      ) : null}
    </p>
  );
}
