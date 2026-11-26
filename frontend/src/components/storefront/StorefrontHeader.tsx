import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router';
import { t } from '../../i18n';
import { useCart } from '../../cart';
import { useDebouncedValue } from '../layout/useDebouncedValue';
import { fill } from './errorMessage';
import { useBag } from './BagProvider';
import { BagIcon, SearchIcon } from './icons';

const SEARCH_DEBOUNCE_MS = 300;

const NAV_LINKS = [
  { to: '/services', label: 'nav.salonServices' },
  { to: '/products', label: 'nav.catalogue' },
  { to: '/services', label: 'nav.skincare' },
  { to: '/services', label: 'nav.makeup' },
  { to: '/about', label: 'nav.ourStory' },
] as const;

const ICON_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-pill text-ink-primary transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover';

/**
 * Slender sticky header: NOORA wordmark, centred navigation (desktop), search toggle and the Bag
 * button with its live count. Bag opens the drawer. Search reveals a panel below the bar.
 */
export function StorefrontHeader() {
  const { itemCount } = useCart();
  const { openBag } = useBag();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:gap-6">
        <Link
          to="/"
          aria-label={t('header.homeLabel')}
          className="shrink-0 font-display text-[1.75rem] leading-none font-semibold tracking-[0.2em] text-ink-primary uppercase"
        >
          {t('brand.name')}
        </Link>

        <nav
          aria-label={t('nav.siteLabel')}
          className="hidden flex-1 items-center justify-center gap-1 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                `rounded-pill px-3 py-2 font-ui text-small font-medium transition-colors hover:bg-sand ${
                  isActive ? 'text-sage-hover' : 'text-ink-primary'
                }`
              }
            >
              {t(link.label)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-expanded={searchOpen}
            aria-controls="site-search-panel"
            onClick={() => setSearchOpen((open) => !open)}
            className={ICON_BUTTON}
          >
            <SearchIcon />
            <span className="sr-only">{t('header.searchToggle')}</span>
          </button>
          <button
            type="button"
            onClick={openBag}
            aria-haspopup="dialog"
            aria-label={
              itemCount > 0
                ? fill(t('header.bagWithCount'), { count: itemCount })
                : t('header.cartLabel')
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-pill px-3 font-ui text-small font-semibold text-ink-primary transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover"
          >
            <BagIcon />
            <span aria-hidden="true">{t('nav.bag')}</span>
            {itemCount > 0 ? (
              <span
                aria-hidden="true"
                className="inline-flex min-w-6 items-center justify-center rounded-pill bg-sage-hover px-1.5 py-1 text-[0.75rem] leading-none text-white"
              >
                {itemCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div id="site-search-panel" className="border-t border-border-subtle">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <SiteSearch />
          </div>
        </div>
      ) : null}
    </header>
  );
}

/** Product search. Typing navigates to /products?q= after a short pause, as before. */
function SiteSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
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
    <form role="search" onSubmit={onSubmit} className="flex items-center">
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
        className="min-h-11 w-full rounded-pill border border-border-subtle bg-sand px-4 font-ui text-body text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover"
      />
      <button
        type="submit"
        className="ml-2 min-h-11 shrink-0 rounded-pill bg-sage-hover px-5 font-ui text-small font-semibold text-white"
      >
        {t('header.searchSubmit')}
      </button>
    </form>
  );
}
