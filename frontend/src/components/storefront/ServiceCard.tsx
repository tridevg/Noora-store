import {
  formatPaise,
  buildEnquiryMessage,
  type ServiceDto,
  type SettingsMap,
} from '@beauty-store/shared';
import { t } from '../../i18n';
import { fill } from './errorMessage';
import { whatsAppLink } from './useSettings';

interface ServiceCardProps {
  service: ServiceDto;
  settings: SettingsMap | undefined;
}

/** One service: name, duration, price, description and a WhatsApp enquiry link. */
export function ServiceCard({ service, settings }: ServiceCardProps) {
  const href = whatsAppLink(
    settings,
    buildEnquiryMessage({
      serviceName: service.name,
      businessName: settings?.business_name || t('brand.name'),
    }),
  );
  return (
    <article className="flex flex-col gap-2 rounded-[1.25rem] border border-border-subtle bg-canvas p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[1.6rem] leading-tight font-medium text-ink-primary">
          {service.name}
        </h3>
        <p className="shrink-0 font-semibold text-ink-primary">
          {formatPaise(service.price_paise)}
        </p>
      </div>
      <p className="text-small text-ink-muted">
        {fill(t('storefront.services.duration'), { minutes: service.duration_minutes })}
      </p>
      {service.description ? (
        <p className="text-body text-ink-primary">{service.description}</p>
      ) : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-pill bg-sage-hover px-4 text-small font-semibold text-white"
        >
          {t('storefront.services.enquire')}
        </a>
      ) : null}
    </article>
  );
}
