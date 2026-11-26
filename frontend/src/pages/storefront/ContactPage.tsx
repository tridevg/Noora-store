import { t } from '../../i18n';
import { buildWhatsAppUrl, type SettingsMap } from '@beauty-store/shared';
import { EditorialPage, EditorialSection } from '../../components/storefront/EditorialPage';
import { Notice } from '../../components/storefront/Notice';
import { useApiResource } from '../../components/storefront/useApiResource';
import { fill } from '../../components/storefront/errorMessage';

/** Digits only, for tel: links. Returns null when the stored number has none. */
export function telHref(number: string): string | null {
  const digits = number.replace(/\D/g, '');
  return digits ? `tel:+${digits}` : null;
}

/** wa.me link without a prefilled message. Null when the number is empty or invalid. */
export function whatsAppHref(number: string): string | null {
  if (!number) return null;
  try {
    return buildWhatsAppUrl(number, '');
  } catch {
    return null;
  }
}

/** Google Maps search for the stored address. Null when no address is set. */
export function mapsHref(address: string): string | null {
  const query = address.trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

/** /contact: WhatsApp (primary), tel: call link, map link and opening hours, from GET /api/settings. */
export default function ContactPage() {
  const { data, error, loading, reload } = useApiResource<{ settings: SettingsMap }>(
    '/api/settings',
  );

  return (
    <EditorialPage
      eyebrow={t('staticPages.contact.eyebrow')}
      title={t('staticPages.contact.title')}
      lead={t('staticPages.contact.lead')}
    >
      {loading ? (
        <p role="status" className="text-body text-ink-muted">
          {t('staticPages.contact.loading')}
        </p>
      ) : null}
      {error ? (
        <Notice tone="error" onRetry={reload}>
          {t('staticPages.contact.unavailable')}
        </Notice>
      ) : null}
      {data ? <ContactDetails settings={data.settings} /> : null}
    </EditorialPage>
  );
}

function ContactDetails({ settings }: { settings: SettingsMap }) {
  const number = settings.whatsapp_number.trim();
  const tel = telHref(number);
  const maps = mapsHref(settings.address);
  const whatsapp = whatsAppHref(number);

  return (
    <>
      <EditorialSection id="contact-whatsapp" heading={t('staticPages.contact.whatsappHeading')}>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('whatsapp.fabLabel')}
            className="inline-flex min-h-12 items-center rounded-pill bg-sage-hover px-6 font-semibold text-white"
          >
            {t('staticPages.contact.whatsappCta')}
          </a>
        ) : (
          <p className="text-body text-ink-muted">{t('whatsapp.unavailable')}</p>
        )}
      </EditorialSection>

      <EditorialSection id="contact-call" heading={t('staticPages.contact.callHeading')}>
        {tel ? (
          <a
            href={tel}
            aria-label={fill(t('staticPages.contact.callLabel'), { number })}
            className="inline-flex min-h-12 items-center font-display text-[1.6rem] leading-tight font-medium text-sage-hover underline"
          >
            {number}
          </a>
        ) : (
          <p className="text-body text-ink-muted">{t('staticPages.contact.notPublished')}</p>
        )}
      </EditorialSection>

      <EditorialSection id="contact-visit" heading={t('staticPages.contact.visitHeading')}>
        <p className="whitespace-pre-line text-body text-ink-primary">
          {settings.address.trim() || t('staticPages.contact.notPublished')}
        </p>
        {maps ? (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-small font-medium text-sage-hover underline"
          >
            {t('staticPages.contact.mapCta')}
          </a>
        ) : null}
      </EditorialSection>

      <EditorialSection id="contact-hours" heading={t('staticPages.contact.hoursHeading')}>
        <p className="whitespace-pre-line text-body text-ink-primary">
          {settings.opening_hours.trim() || t('staticPages.contact.notPublished')}
        </p>
      </EditorialSection>
    </>
  );
}
