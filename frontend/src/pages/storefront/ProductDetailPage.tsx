import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import type { ProductDetailDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { useCart } from '../../cart';
import { useBag } from '../../components/storefront/BagProvider';
import { lineForVariant } from '../../components/storefront/bagActions';
import { ProductGallery } from '../../components/storefront/ProductGallery';
import { errorMessage, fill } from '../../components/storefront/errorMessage';
import { Notice } from '../../components/storefront/Notice';
import { PriceLabel } from '../../components/storefront/PriceLabel';
import { useApiResource } from '../../components/storefront/useApiResource';
import { useSettings, whatsAppLink } from '../../components/storefront/useSettings';
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
import { Badge } from '../../components/ui/Badge';
import { Button, buttonClass } from '../../components/ui/Button';

/** /product/:slug: gallery with zoom, size and colour selectors that drive stock, and Add to Bag. */
export default function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { data, error, loading, reload } = useApiResource<{ product: ProductDetailDto }>(
    `/api/products/${encodeURIComponent(slug)}`,
  );

  if (loading) {
    // Fixed-height placeholders close to the loaded layout (title, price, pills, buttons, text),
    // so data arriving does not push the footer or the bottom bar around.
    return (
      <div aria-busy="true" className="grid gap-8 pb-28 md:grid-cols-2 md:gap-12 md:pb-8">
        <div className="space-y-3">
          <div className="aspect-[3/4] animate-pulse rounded-[1.25rem] bg-sand" />
          {/* Thumbnail strip height (size-16 plus gap), which the loaded gallery adds below the image. */}
          <div className="h-16 w-full" />
        </div>
        <div className="space-y-6 md:pt-4">
          <div className="space-y-3">
            <div className="h-[5.5rem] w-3/4 animate-pulse rounded bg-sand md:h-[6.5rem]" />
            <div className="h-7 w-1/3 animate-pulse rounded bg-sand" />
          </div>
          <div className="space-y-4">
            <div className="h-[6.5rem] w-full animate-pulse rounded-[1.25rem] bg-sand" />
            <div className="h-[6.5rem] w-full animate-pulse rounded-[1.25rem] bg-sand" />
          </div>
          <div className="h-12 w-full animate-pulse rounded-pill bg-sand" />
          <div className="space-y-2 border-t border-border-subtle pt-6">
            <div className="h-8 w-1/2 animate-pulse rounded bg-sand" />
            <div className="h-24 w-full animate-pulse rounded bg-sand" />
          </div>
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
  const { openBag } = useBag();
  const settings = useSettings();
  const { pathname } = useLocation();
  // Per-product title and description. The layout's generic meta is the fallback while loading.
  useDocumentMeta(
    { title: documentTitle(product.name), description: metaDescription(product) },
    pathname,
  );
  const [choice, setChoice] = useState<VariantChoice | undefined>(() =>
    defaultChoice(product.variants),
  );

  const variant = choice ? findVariant(product.variants, choice) : undefined;
  const canBuy = variant !== undefined && maxQtyForStock(variant.stock) > 0;
  const orderHref = whatsAppLink(
    settings,
    variant
      ? fill(t('storefront.product.whatsAppMessage'), {
          name: product.name,
          size: variant.size,
          colour: variant.colour,
        })
      : product.name,
  );

  function onAdd() {
    if (!variant || !canBuy) return;
    addLine(lineForVariant(product, variant));
    openBag();
  }

  const addLabel = t('storefront.product.addToCart');

  return (
    <article className="grid gap-8 pb-28 md:grid-cols-2 md:gap-12 md:pb-8">
      <ProductGallery images={product.images} alt={product.name} />

      <div className="space-y-6 md:pt-4">
        <header className="space-y-3">
          <h1 className="font-display text-[2.6rem] leading-[1.05] font-medium text-ink-primary md:text-[3.2rem]">
            {product.name}
          </h1>
          <PriceLabel mrpPaise={product.mrp_paise} pricePaise={product.price_paise} size="detail" />
          {product.in_stock ? null : (
            <Badge tone="soldOut">{t('storefront.card.outOfStock')}</Badge>
          )}
        </header>

        {choice ? (
          <VariantPicker variants={product.variants} value={choice} onChange={setChoice} />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" className="flex-1 md:flex-none" disabled={!canBuy} onClick={onAdd}>
            {addLabel}
          </Button>
          {orderHref ? (
            <a
              href={orderHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({
                variant: 'outline',
                size: 'lg',
                className: 'flex-1 md:flex-none',
              })}
            >
              {t('storefront.product.orderWhatsApp')}
            </a>
          ) : null}
          {variant && !canBuy ? (
            <p className="font-ui text-small font-medium text-danger">
              {t('storefront.card.outOfStock')}
            </p>
          ) : null}
        </div>

        {product.description ? (
          <section
            aria-labelledby="description-heading"
            className="space-y-2 border-t border-border-subtle pt-6"
          >
            <h2
              id="description-heading"
              className="font-display text-[1.6rem] leading-tight font-medium text-ink-primary"
            >
              {t('storefront.product.description')}
            </h2>
            <p className="font-ui whitespace-pre-line text-body text-ink-primary">
              {product.description}
            </p>
          </section>
        ) : null}
      </div>

      {/* Mobile purchase bar, above the bottom navigation. Add to Bag and WhatsApp stay in reach. */}
      <div className="fixed inset-x-0 bottom-14 z-30 flex gap-2 border-t border-border-subtle bg-canvas/95 p-3 backdrop-blur md:hidden">
        <Button className="flex-1" disabled={!canBuy} onClick={onAdd}>
          {addLabel}
        </Button>
        {orderHref ? (
          <a
            href={orderHref}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: 'outline', className: 'flex-1' })}
          >
            {t('storefront.product.orderWhatsApp')}
          </a>
        ) : null}
      </div>
    </article>
  );
}
