import { Link } from 'react-router';
import type { CategoryDto, ProductSummaryDto, ServiceDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { Notice } from '../../components/storefront/Notice';
import { ProductGrid, ProductGridSkeleton } from '../../components/storefront/ProductGrid';
import { ServiceCard } from '../../components/storefront/ServiceCard';
import { errorMessage } from '../../components/storefront/errorMessage';
import { useApiResource } from '../../components/storefront/useApiResource';
import { useSettings } from '../../components/storefront/useSettings';

const FEATURED_COUNT = 8;
const SERVICE_PREVIEW_COUNT = 4;

export default function HomePage() {
  const settings = useSettings();
  const categories = useApiResource<{ categories: CategoryDto[] }>('/api/categories');
  const featured = useApiResource<{ items: ProductSummaryDto[] }>(
    `/api/products?sort=popularity&per_page=${FEATURED_COUNT}`,
  );
  const services = useApiResource<{ services: ServiceDto[] }>('/api/services');

  const productCategories = (categories.data?.categories ?? []).filter((c) => c.type === 'product');
  const serviceList = (services.data?.services ?? []).filter((s) => s.is_active !== false);

  return (
    <div className="space-y-10 pt-2">
      <section
        aria-labelledby="hero-heading"
        className="rounded-card bg-accent px-6 py-10 text-accent-ink shadow-card md:px-10 md:py-14"
      >
        <h1 id="hero-heading" className="text-display font-semibold">
          {settings?.banner_text || t('storefront.home.heroFallback')}
        </h1>
        <Link
          to="/products"
          className="mt-6 inline-flex min-h-11 items-center rounded-pill bg-surface-raised px-6 font-semibold text-ink"
        >
          {t('storefront.home.shopNow')}
        </Link>
      </section>

      <section id="categories" aria-labelledby="categories-heading" className="space-y-4">
        <h2 id="categories-heading" className="text-heading font-semibold text-ink">
          {t('storefront.home.categoriesHeading')}
        </h2>
        {categories.error ? (
          <Notice tone="error" onRetry={categories.reload}>
            {errorMessage(categories.error)}
          </Notice>
        ) : categories.loading ? (
          // Same tile footprint as the loaded list, so the content below does not shift on load.
          <ul aria-hidden="true" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="min-h-20 animate-pulse rounded-card bg-surface-raised" />
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {productCategories.map((category) => (
              <li key={category.id}>
                <Link
                  to={`/category/${encodeURIComponent(category.slug)}`}
                  className="flex min-h-20 items-center justify-center rounded-card bg-surface-raised p-4 text-center font-medium text-ink shadow-card"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="featured-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="featured-heading" className="text-heading font-semibold text-ink">
            {t('storefront.home.featuredHeading')}
          </h2>
          <Link to="/products" className="text-small font-medium text-accent">
            {t('storefront.home.viewAll')}
          </Link>
        </div>
        {featured.loading ? (
          <ProductGridSkeleton count={4} />
        ) : featured.error ? (
          <Notice tone="error" onRetry={featured.reload}>
            {errorMessage(featured.error)}
          </Notice>
        ) : featured.data && featured.data.items.length === 0 ? (
          // Reserve the grid's height so an empty catalogue does not pull the footer up on load.
          <p className="flex min-h-64 items-center justify-center rounded-card bg-surface-raised p-6 text-center text-muted shadow-card">
            {t('storefront.home.noProducts')}
          </p>
        ) : (
          <ProductGrid products={featured.data?.items ?? []} />
        )}
      </section>

      {serviceList.length > 0 ? (
        <section aria-labelledby="services-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="services-heading" className="text-heading font-semibold text-ink">
              {t('storefront.home.servicesHeading')}
            </h2>
            <Link to="/services" className="text-small font-medium text-accent">
              {t('storefront.home.viewAllServices')}
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {serviceList.slice(0, SERVICE_PREVIEW_COUNT).map((service) => (
              <ServiceCard key={service.id} service={service} settings={settings} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
