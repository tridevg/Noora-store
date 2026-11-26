import { Outlet } from 'react-router';
import { t } from '../../i18n';
import { BottomNav } from './BottomNav';
import { StorefrontHeader } from './StorefrontHeader';
import { WhatsAppFab } from './WhatsAppFab';
import { useWhatsAppHref } from './useWhatsAppHref';

/** Storefront chrome around every public route. Admin routes do not use this layout. */
export function StorefrontLayout() {
  const whatsappHref = useWhatsAppHref();
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        {t('common.skipToContent')}
      </a>
      <StorefrontHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 pt-4 pb-24 md:pb-10">
        <Outlet />
      </main>
      <BottomNav whatsappHref={whatsappHref} />
      <WhatsAppFab href={whatsappHref} />
    </div>
  );
}
