import { useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { CategoryDto, ProductSummaryDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { useFocusTrap } from '../layout/useFocusTrap';
import {
  PER_PAGE,
  parseCatalogParams,
  toApiQuery,
  toSearchParams,
  type CatalogFilters,
  type ProductSort,
} from './catalogQuery';
import { errorMessage, fill } from './errorMessage';
import { Notice } from './Notice';
import { ProductGrid, ProductGridSkeleton } from './ProductGrid';
import { useApiResource } from './useApiResource';

interface ProductListResponse {
  items: ProductSummaryDto[];
  page: number;
  per_page: number;
  total: number;
}

const FIELD_CLASS =
  'min-h-11 w-full rounded-card border border-border bg-surface-raised px-3 text-ink';

/**
 * Catalogue grid shared by /products and /category/:slug. Filters, sort and page live in the URL.
 * `categorySlug` is set on /category/:slug and pins the category; otherwise a category select shows.
 */
export function CatalogView({ categorySlug }: { categorySlug?: string }) {
  const [params, setParams] = useSearchParams();
  const filters = parseCatalogParams(params, categorySlug);
  const query = toApiQuery(filters);
  const products = useApiResource<ProductListResponse>(`/api/products?${query}`);
  const categories = useApiResource<{ categories: CategoryDto[] }>('/api/categories');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const productCategories = (categories.data?.categories ?? []).filter((c) => c.type === 'product');
  const pinned = categorySlug ? productCategories.find((c) => c.slug === categorySlug) : undefined;
  const heading = filters.q.trim()
    ? fill(t('storefront.catalog.resultsFor'), { query: filters.q.trim() })
    : (pinned?.name ?? t('storefront.catalog.title'));

  const data = products.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;

  function update(next: CatalogFilters) {
    setParams(toSearchParams(next, categorySlug === undefined));
  }

  return (
    <div className="md:flex md:gap-8">
      <div className="py-2 md:hidden">
        <button
          type="button"
          aria-expanded={drawerOpen}
          aria-controls="catalog-filters"
          onClick={() => setDrawerOpen(true)}
          className="min-h-11 rounded-pill border border-border bg-surface-raised px-4 text-small font-medium text-ink"
        >
          {t('storefront.catalog.filters')}
        </button>
      </div>

      <FilterPanel
        key={query}
        id="catalog-filters"
        open={drawerOpen}
        filters={filters}
        categories={productCategories}
        showCategory={categorySlug === undefined}
        onClose={() => setDrawerOpen(false)}
        onApply={(next) => {
          setDrawerOpen(false);
          update({ ...next, page: 1 });
        }}
      />

      <section className="min-w-0 flex-1" aria-labelledby="catalog-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <h1 id="catalog-heading" className="text-display font-semibold text-ink">
            {heading}
          </h1>
          <label className="flex items-center gap-2 text-small text-muted">
            <span>{t('storefront.catalog.sortBy')}</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                update({ ...filters, sort: event.target.value as ProductSort, page: 1 })
              }
              className="min-h-11 rounded-card border border-border bg-surface-raised px-3 text-ink"
            >
              <option value="newest">{t('storefront.catalog.sortNewest')}</option>
              <option value="price_asc">{t('storefront.catalog.sortPriceAsc')}</option>
              <option value="price_desc">{t('storefront.catalog.sortPriceDesc')}</option>
              <option value="popularity">{t('storefront.catalog.sortPopularity')}</option>
            </select>
          </label>
        </div>

        <div className="py-2">
          {products.loading ? (
            <>
              <p className="sr-only" role="status">
                {t('storefront.catalog.loading')}
              </p>
              <ProductGridSkeleton />
            </>
          ) : products.error ? (
            <Notice tone="error" onRetry={products.reload}>
              {errorMessage(products.error)}
            </Notice>
          ) : data && data.items.length > 0 ? (
            <>
              <p className="pb-3 text-small text-muted">
                {fill(t('storefront.catalog.resultCount'), { count: data.total })}
              </p>
              <ProductGrid products={data.items} />
            </>
          ) : (
            <Notice>{t('storefront.catalog.empty')}</Notice>
          )}
        </div>

        {data && totalPages > 1 ? (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3 py-6">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => update({ ...filters, page: filters.page - 1 })}
              className="min-h-11 rounded-pill border border-border px-4 text-small text-ink disabled:opacity-40"
            >
              <span aria-hidden="true">←</span> {t('storefront.catalog.prevPage')}
            </button>
            <span className="text-small text-muted">
              {fill(t('storefront.catalog.pageOf'), { page: filters.page, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => update({ ...filters, page: filters.page + 1 })}
              className="min-h-11 rounded-pill border border-border px-4 text-small text-ink disabled:opacity-40"
            >
              {t('storefront.catalog.nextPage')} <span aria-hidden="true">→</span>
            </button>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

interface FilterPanelProps {
  id: string;
  open: boolean;
  filters: CatalogFilters;
  categories: CategoryDto[];
  showCategory: boolean;
  onApply: (next: CatalogFilters) => void;
  onClose: () => void;
}

/**
 * Filter form. A sidebar on desktop and a full-screen drawer on phones. Keyed by the query
 * string by the parent, so the draft resets whenever the URL changes.
 */
function FilterPanel({
  id,
  open,
  filters,
  categories,
  showCategory,
  onApply,
  onClose,
}: FilterPanelProps) {
  const [draft, setDraft] = useState<CatalogFilters>(filters);
  const panelRef = useRef<HTMLElement>(null);
  // Only the phone drawer is modal. The desktop sidebar is never open, so the trap stays idle there.
  useFocusTrap(panelRef, open, onClose);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(draft);
  }

  function reset() {
    setDraft({
      ...draft,
      minRupees: '',
      maxRupees: '',
      size: '',
      colour: '',
      inStock: false,
      category: showCategory ? '' : filters.category,
    });
  }

  return (
    <aside
      ref={panelRef}
      id={id}
      role={open ? 'dialog' : undefined}
      aria-modal={open ? true : undefined}
      aria-label={t('storefront.catalog.filters')}
      className={`${
        open ? 'fixed inset-0 z-40 overflow-y-auto bg-surface p-4' : 'hidden'
      } md:sticky md:top-20 md:block md:h-fit md:w-60 md:shrink-0 md:p-0`}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between md:hidden">
          <h2 className="text-heading font-semibold text-ink">{t('storefront.catalog.filters')}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-small text-ink">
            {t('storefront.catalog.closeFilters')}
          </button>
        </div>

        {showCategory ? (
          <label className="block space-y-1 text-small text-muted">
            <span>{t('storefront.catalog.category')}</span>
            <select
              className={FIELD_CLASS}
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            >
              <option value="">{t('storefront.catalog.allCategories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-small text-muted">
            <span>{t('storefront.catalog.minPrice')}</span>
            <input
              inputMode="numeric"
              value={draft.minRupees}
              onChange={(event) => setDraft({ ...draft, minRupees: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>
          <label className="space-y-1 text-small text-muted">
            <span>{t('storefront.catalog.maxPrice')}</span>
            <input
              inputMode="numeric"
              value={draft.maxRupees}
              onChange={(event) => setDraft({ ...draft, maxRupees: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <label className="block space-y-1 text-small text-muted">
          <span>{t('storefront.catalog.size')}</span>
          <input
            value={draft.size}
            maxLength={20}
            onChange={(event) => setDraft({ ...draft, size: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>

        <label className="block space-y-1 text-small text-muted">
          <span>{t('storefront.catalog.colour')}</span>
          <input
            value={draft.colour}
            maxLength={40}
            onChange={(event) => setDraft({ ...draft, colour: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 text-small text-ink">
          <input
            type="checkbox"
            checked={draft.inStock}
            onChange={(event) => setDraft({ ...draft, inStock: event.target.checked })}
            className="size-5 accent-accent"
          />
          {t('storefront.catalog.inStockOnly')}
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 flex-1 rounded-pill border border-border text-small text-ink"
          >
            {t('storefront.catalog.resetFilters')}
          </button>
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-pill bg-accent text-small font-semibold text-accent-ink"
          >
            {t('storefront.catalog.applyFilters')}
          </button>
        </div>
      </form>
    </aside>
  );
}
