import { Link } from 'react-router';
import type { ProductSummaryDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { errorMessage } from './errorMessage';
import { Notice } from './Notice';
import { ProductGrid, ProductGridSkeleton } from './ProductGrid';
import { useApiResource } from './useApiResource';

const ARRIVALS_COUNT = 8;

/** Newest products from GET /api/products?sort=newest. */
export function NewArrivalsGrid() {
  const { data, error, loading, reload } = useApiResource<{ items: ProductSummaryDto[] }>(
    `/api/products?sort=newest&per_page=${ARRIVALS_COUNT}`,
  );

  return (
    <section aria-labelledby="arrivals-heading" className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h2
          id="arrivals-heading"
          className="font-display text-[2rem] leading-tight font-medium text-ink-primary"
        >
          {t('storefront.arrivals.heading')}
        </h2>
        <Link
          to="/products"
          className="font-ui text-small font-semibold text-sage-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover"
        >
          {t('storefront.arrivals.viewAll')}
        </Link>
      </div>
      {loading ? (
        <ProductGridSkeleton count={ARRIVALS_COUNT} />
      ) : error ? (
        <Notice tone="error" onRetry={reload}>
          {errorMessage(error)}
        </Notice>
      ) : data && data.items.length === 0 ? (
        <p className="flex min-h-64 items-center justify-center rounded-[1.25rem] bg-sand p-6 text-center font-ui text-ink-muted">
          {t('storefront.home.noProducts')}
        </p>
      ) : (
        <ProductGrid products={data?.items ?? []} />
      )}
    </section>
  );
}
