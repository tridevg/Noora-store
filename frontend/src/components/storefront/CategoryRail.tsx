import { Link } from 'react-router';
import type { CategoryDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { ArrowUpRightIcon } from './icons';
import { Notice } from './Notice';
import { errorMessage } from './errorMessage';
import { useApiResource } from './useApiResource';

// Matches the live catalogue's product category count, so the placeholder row count equals the
// loaded one and the section below does not move when data arrives.
const CARD_COUNT = 5;

/**
 * Product categories from GET /api/categories, one card each. Categories added in /admin appear
 * here without a code change. Only a loading placeholder is shown before the first response.
 */
export function CategoryRail() {
  const { data, error, loading, reload } = useApiResource<{ categories: CategoryDto[] }>(
    '/api/categories',
  );
  const categories = (data?.categories ?? []).filter((c) => c.type === 'product');

  return (
    <section id="categories" aria-labelledby="categories-heading" className="space-y-5">
      <h2
        id="categories-heading"
        className="font-display text-[2rem] leading-tight font-medium text-ink-primary"
      >
        {t('storefront.rail.heading')}
      </h2>
      {error ? (
        <Notice tone="error" onRetry={reload}>
          {errorMessage(error)}
        </Notice>
      ) : loading ? (
        <ul aria-hidden="true" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: CARD_COUNT }, (_, index) => (
            <li key={index} className="h-44 animate-pulse rounded-[1.25rem] bg-sand" />
          ))}
        </ul>
      ) : categories.length === 0 ? null : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {categories.map((category) => (
            <li key={category.id}>
              <article className="flex h-44 flex-col justify-between rounded-[1.25rem] bg-sand p-5">
                <h3 className="font-display text-[1.6rem] leading-tight font-medium text-ink-primary">
                  {category.name}
                </h3>
                <Link
                  to={`/category/${encodeURIComponent(category.slug)}`}
                  className="inline-flex items-center gap-1.5 font-ui text-small font-semibold text-sage-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover"
                >
                  {t('storefront.rail.explore')}
                  <ArrowUpRightIcon />
                  <span className="sr-only">{category.name}</span>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
