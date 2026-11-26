import { t } from '../../i18n';
import { cn } from '../ui/cn';

interface WhatsAppFabProps {
  /** wa.me link. The button renders nothing when null. */
  href: string | null;
  className?: string;
}

/** Floating WhatsApp button. Sits above the mobile bottom nav and bottom-right on desktop. */
export function WhatsAppFab({ href, className }: WhatsAppFabProps) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsapp.fabLabel')}
      className={cn(
        'fixed right-4 bottom-20 z-30 inline-flex min-h-12 items-center rounded-pill bg-sage-hover px-5 font-ui text-small font-semibold text-white shadow-card transition-colors hover:bg-sage-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover md:bottom-6',
        className,
      )}
    >
      {t('nav.whatsapp')}
    </a>
  );
}
