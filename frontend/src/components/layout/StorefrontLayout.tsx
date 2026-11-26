import { Link, Outlet, useLocation } from 'react-router';
import { t } from '../../i18n';
import { BottomNav } from './BottomNav';
import { StorefrontHeader } from './StorefrontHeader';
import { WhatsAppFab } from './WhatsAppFab';
import { useDocumentMeta } from './useDocumentMeta';
import { storefrontMeta } from './seo';
import { useWhatsAppHref } from './useWhatsAppHref';

const FOOTER_LINK = 'text-small font-medium text-ink underline-offset-4 hover:underline';

/** Storefront chrome around every public route. Admin routes do not use this layout. */
export function StorefrontLayout() {
  const whatsappHref = useWhatsAppHref();
  const { pathname } = useLocation();
  useDocumentMeta(storefrontMeta(pathname), pathname);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        {t('common.skipToContent')}
      </a>
      <StorefrontHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-4 pb-24 md:pb-10">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-surface-raised">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 pb-24 md:grid-cols-3 md:pb-8">
          <div className="space-y-2">
            <p className="text-heading font-semibold text-ink">{t('brand.name')}</p>
            <p className="text-small text-muted">{t('footer.tagline')}</p>
          </div>
          <nav aria-label={t('nav.footerLabel')}>
            <ul className="grid grid-cols-2 gap-3">
              <li>
                <Link to="/about" className={FOOTER_LINK}>
                  {t('footer.about')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className={FOOTER_LINK}>
                  {t('footer.contact')}
                </Link>
              </li>
              <li>
                <Link to="/shipping-returns" className={FOOTER_LINK}>
                  {t('footer.shippingReturns')}
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className={FOOTER_LINK}>
                  {t('footer.privacyPolicy')}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-small text-muted md:text-right">
            © {new Date().getFullYear()} {t('brand.name')}. {t('footer.rights')}
          </p>
        </div>
      </footer>
      <BottomNav whatsappHref={whatsappHref} />
      <WhatsAppFab href={whatsappHref} />
    </div>
  );
}
