import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ProductDetailDto, ProductSummaryDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { useCart } from '../../cart';
import { apiGet } from '../../lib/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useBag } from './BagProvider';
import { lineForVariant, quickAddVariant } from './bagActions';
import { PriceLabel } from './PriceLabel';

/** Responsive product grid: 2 columns on phones, up to 4 on desktop. */
export function ProductGrid({ products }: { products: readonly ProductSummaryDto[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One product: 3:4 portrait image, Discount and stock badges, name, price and Add to Bag.
 * The list data has no variants, so Add to Bag reads the product once. A single-variant product
 * goes straight to the bag. Anything with several sizes or colours opens the product page, so
 * the customer chooses the variant.
 */
export function ProductCard({ product }: { product: ProductSummaryDto }) {
  const { addLine } = useCart();
  const { openBag } = useBag();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const productPath = `/product/${encodeURIComponent(product.slug)}`;
  const onSale = product.mrp_paise > product.price_paise;

  async function quickAdd() {
    setBusy(true);
    try {
      const body = await apiGet<{ product: ProductDetailDto }>(
        `/api/products/${encodeURIComponent(product.slug)}`,
      );
      const detail = body.product;
      const only = quickAddVariant(detail.variants);
      if (only) {
        addLine(lineForVariant(detail, only));
        openBag();
      } else {
        navigate(productPath);
      }
    } catch {
      navigate(productPath);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex h-full flex-col">
      <Link
        to={productPath}
        tabIndex={-1}
        aria-label={product.name}
        className="relative block aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-sand"
      >
        {product.thumb_url ? (
          <img
            src={product.thumb_url}
            alt=""
            loading="lazy"
            decoding="async"
            width={400}
            height={533}
            className="size-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        ) : null}
        {onSale ? (
          <Badge tone="discount" className="absolute top-3 left-3">
            {t('storefront.arrivals.discount')}
          </Badge>
        ) : null}
        <Badge tone={product.in_stock ? 'stock' : 'soldOut'} className="absolute bottom-3 left-3">
          {product.in_stock ? t('storefront.arrivals.inStock') : t('storefront.card.outOfStock')}
        </Badge>
      </Link>
      <div className="flex flex-1 flex-col gap-2 pt-3">
        <h3 className="font-ui text-small font-medium text-ink-primary">
          <Link
            to={productPath}
            className="line-clamp-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover"
          >
            {product.name}
          </Link>
        </h3>
        <PriceLabel mrpPaise={product.mrp_paise} pricePaise={product.price_paise} />
        <Button
          variant="outline"
          size="sm"
          className="mt-auto w-full"
          disabled={!product.in_stock || busy}
          aria-busy={busy || undefined}
          onClick={() => void quickAdd()}
        >
          {t('storefront.arrivals.addToBag')}
          <span className="sr-only">: {product.name}</span>
        </Button>
      </div>
    </article>
  );
}

/** Placeholder cards shown while a grid loads. Hidden from assistive tech; the caller announces loading. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="animate-pulse">
          <div className="aspect-[3/4] rounded-[1.25rem] bg-sand" />
          <div className="space-y-2 pt-3">
            <div className="h-4 w-3/4 rounded bg-sand" />
            <div className="h-4 w-1/2 rounded bg-sand" />
          </div>
        </li>
      ))}
    </ul>
  );
}
