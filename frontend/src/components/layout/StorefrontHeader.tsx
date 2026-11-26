import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { t } from '../../i18n';
import { useCart } from '../../cart';
import { useDebouncedValue } from './useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 300;

/** Sticky storefront header with debounced product search and a cart badge. */
export function StorefrontHeader() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { itemCount } = useCart();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // Only user edits trigger navigation, so loading /products?q=x does not redirect.
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    const q = debounced.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  }, [debounced, navigate]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface-raised/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link
          to="/"
          aria-label={t('header.homeLabel')}
          className="shrink-0 text-heading font-semibold text-ink"
        >
          {t('brand.name')}
        </Link>
        <form role="search" onSubmit={onSubmit} className="flex flex-1 items-center">
          <label htmlFor="site-search" className="sr-only">
            {t('header.searchLabel')}
          </label>
          <input
            id="site-search"
            type="search"
            value={query}
            placeholder={t('header.searchPlaceholder')}
            onChange={(event) => {
              dirty.current = true;
              setQuery(event.target.value);
            }}
            className="w-full rounded-pill border border-border bg-surface px-4 py-2 text-body text-ink placeholder:text-muted focus:outline-2 focus:outline-accent"
          />
          <button type="submit" className="sr-only">
            {t('header.searchSubmit')}
          </button>
        </form>
        <nav aria-label={t('nav.siteLabel')} className="hidden shrink-0 items-center gap-1 md:flex">
          <Link to="/" className="rounded-pill px-3 py-2 text-small font-medium text-ink">
            {t('nav.home')}
          </Link>
          <Link to="/products" className="rounded-pill px-3 py-2 text-small font-medium text-ink">
            {t('storefront.catalog.title')}
          </Link>
          <Link to="/services" className="rounded-pill px-3 py-2 text-small font-medium text-ink">
            {t('nav.services')}
          </Link>
        </nav>
        <Link
          to="/cart"
          aria-label={t('header.cartLabel')}
          className="hidden shrink-0 rounded-pill px-3 py-2 text-small font-medium text-ink md:inline-flex"
        >
          {t('nav.cart')}
          <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-pill bg-accent px-2 text-small text-accent-ink">
            {itemCount}
          </span>
        </Link>
      </div>
    </header>
  );
}
