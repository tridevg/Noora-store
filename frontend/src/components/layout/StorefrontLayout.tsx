import { Outlet, useLocation } from 'react-router';
import { t } from '../../i18n';
import { BagProvider } from '../storefront/BagProvider';
import { StorefrontFooter } from '../storefront/StorefrontFooter';
import { StorefrontHeader } from '../storefront/StorefrontHeader';
import { BottomNav } from './BottomNav';
import { WhatsAppFab } from './WhatsAppFab';
import { useDocumentMeta } from './useDocumentMeta';
import { storefrontMeta } from './seo';
import { useWhatsAppHref } from './useWhatsAppHref';

/** Storefront chrome around every public route. Admin routes do not use this layout. */
export function StorefrontLayout() {
  const whatsappHref = useWhatsAppHref();
  const { pathname } = useLocation();
  useDocumentMeta(storefrontMeta(pathname), pathname);
  // The product page has its own sticky buy bar on phones, so the floating WhatsApp button steps aside.
  const onProduct = pathname.startsWith('/product/');

  return (
    <BagProvider>
      <div className="min-h-dvh bg-canvas font-ui text-ink-primary">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-pill focus:bg-sage-hover focus:px-4 focus:py-2 focus:text-white"
        >
          {t('common.skipToContent')}
        </a>
        <StorefrontHeader />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-4 pt-4 pb-24 focus:outline-none md:pb-14"
        >
          <Outlet />
        </main>
        <StorefrontFooter />
        <BottomNav whatsappHref={whatsappHref} />
        <WhatsAppFab
          href={whatsappHref}
          className={onProduct ? 'hidden md:inline-flex' : undefined}
        />
      </div>
    </BagProvider>
  );
}
