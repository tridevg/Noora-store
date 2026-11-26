import { t } from '../../i18n';

interface WhatsAppFabProps {
  /** wa.me link. The button renders nothing when null. */
  href: string | null;
}

/** Floating WhatsApp button. Sits above the mobile bottom nav and bottom-right on desktop. */
export function WhatsAppFab({ href }: WhatsAppFabProps) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsapp.fabLabel')}
      className="fixed right-4 bottom-20 z-30 inline-flex min-h-12 items-center rounded-pill bg-accent px-4 py-3 text-small font-semibold text-accent-ink shadow-card md:bottom-6"
    >
      {t('nav.whatsapp')}
    </a>
  );
}
