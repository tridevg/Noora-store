import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type { ProductDetailDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { useCart } from '../../cart';
import { ProductGallery } from '../../components/storefront/ProductGallery';
import { errorMessage } from '../../components/storefront/errorMessage';
import { Notice } from '../../components/storefront/Notice';
import { PriceLabel } from '../../components/storefront/PriceLabel';
import { useApiResource } from '../../components/storefront/useApiResource';
import {
  defaultChoice,
  findVariant,
  VariantPicker,
  type VariantChoice,
} from '../../components/storefront/VariantPicker';
import { ApiError } from '../../lib/api';
import { documentTitle } from '../../components/layout/seo';
import { useDocumentMeta } from '../../components/layout/useDocumentMeta';
import { maxQtyForStock } from '../../components/storefront/stockCap';

/** /product/:slug: gallery with zoom, size and colour selectors that drive stock, and Add to Cart. */
export default function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { data, error, loading, reload } = useApiResource<{ product: ProductDetailDto }>(
    `/api/products/${encodeURIComponent(slug)}`,
  );

  if (loading) {
    return (
      <div aria-busy="true" className="grid gap-6 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-card bg-border" />
        <div className="space-y-3">
          <div className="h-8 w-3/4 animate-pulse rounded bg-border" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-border" />
        </div>
      </div>
    );
  }
  if (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <Notice tone="error" onRetry={missing ? undefined : reload}>
        {missing ? t('storefront.product.notFound') : errorMessage(error)}
      </Notice>
    );
  }
  if (!data) return null;
  return <ProductView key={data.product.slug} product={data.product} />;
}

/** Meta description from the product text: whitespace collapsed and cut to about 160 characters. */
function metaDescription(product: ProductDetailDto): string {
  const text = product.description?.replace(/\s+/g, ' ').trim() ?? '';
  if (!text) return t('seo.productDetail.description');
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

function ProductView({ product }: { product: ProductDetailDto }) {
  const { addLine } = useCart();
  const { pathname } = useLocation();
  // Per-product title and description. The layout's generic meta is the fallback while loading.
  useDocumentMeta(
    { title: documentTitle(product.name), description: metaDescription(product) },
    pathname,
  );
  const [choice, setChoice] = useState<VariantChoice | undefined>(() =>
    defaultChoice(product.variants),
  );
  // Remembers which variant was added, so the confirmation hides when the selection moves on.
  const [addedVariantId, setAddedVariantId] = useState<number | null>(null);

  const variant = choice ? findVariant(product.variants, choice) : undefined;
  const canBuy = variant !== undefined && maxQtyForStock(variant.stock) > 0;

  function onAdd() {
    if (!variant || !canBuy) return;
    addLine({
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      size: variant.size,
      colour: variant.colour,
      unitPricePaise: product.price_paise,
      qty: 1,
    });
    setAddedVariantId(variant.id);
  }

  return (
    <article className="grid gap-6 pb-6 md:grid-cols-2 md:gap-10">
      <ProductGallery images={product.images} alt={product.name} />

      <div className="space-y-5">
        <header className="space-y-2">
          <h1 className="text-display font-semibold text-ink">{product.name}</h1>
          <PriceLabel mrpPaise={product.mrp_paise} pricePaise={product.price_paise} size="detail" />
        </header>

        {choice ? (
          <VariantPicker
            variants={product.variants}
            value={choice}
            onChange={(next) => {
              setChoice(next);
              setAddedVariantId(null);
            }}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canBuy}
            onClick={onAdd}
            className="min-h-12 flex-1 rounded-pill bg-accent px-6 font-semibold text-accent-ink disabled:opacity-40 md:flex-none"
          >
            {t('storefront.product.addToCart')}
          </button>
          {variant && !canBuy ? (
            <p className="text-small font-medium text-danger">{t('storefront.card.outOfStock')}</p>
          ) : null}
          {variant && addedVariantId === variant.id ? (
            <p role="status" className="text-small text-ink">
              {t('storefront.product.addedToCart')}{' '}
              <Link to="/cart" className="font-medium text-accent underline">
                {t('storefront.product.viewCart')}
              </Link>
            </p>
          ) : null}
        </div>

        {product.description ? (
          <section aria-labelledby="description-heading" className="space-y-2">
            <h2 id="description-heading" className="text-heading font-semibold text-ink">
              {t('storefront.product.description')}
            </h2>
            <p className="whitespace-pre-line text-body text-ink">{product.description}</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}
