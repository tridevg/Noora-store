import { Link } from 'react-router';
import type { ProductSummaryDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { PriceLabel } from './PriceLabel';

/** Responsive product grid: 2 columns on phones, up to 4 on desktop. */
export function ProductGrid({ products }: { products: readonly ProductSummaryDto[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductCard({ product }: { product: ProductSummaryDto }) {
  return (
    <Link
      to={`/product/${encodeURIComponent(product.slug)}`}
      className="flex h-full flex-col overflow-hidden rounded-card bg-surface-raised shadow-card focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-square bg-border">
        {product.thumb_url ? (
          <img
            src={product.thumb_url}
            alt=""
            loading="lazy"
            decoding="async"
            width={400}
            height={400}
            className="size-full object-cover"
          />
        ) : null}
        {product.in_stock ? null : (
          <span className="absolute top-2 left-2 rounded-pill bg-ink px-2 py-1 text-[0.7rem] text-surface-raised">
            {t('storefront.card.outOfStock')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-small font-medium text-ink">{product.name}</h3>
        <PriceLabel mrpPaise={product.mrp_paise} pricePaise={product.price_paise} />
      </div>
    </Link>
  );
}

/** Placeholder cards shown while a grid loads. Hidden from assistive tech; the caller announces loading. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="animate-pulse overflow-hidden rounded-card bg-surface-raised shadow-card"
        >
          <div className="aspect-square bg-border" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-3/4 rounded bg-border" />
            <div className="h-4 w-1/2 rounded bg-border" />
          </div>
        </li>
      ))}
    </ul>
  );
}
