import type { ServiceDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { errorMessage } from '../../components/storefront/errorMessage';
import { Notice } from '../../components/storefront/Notice';
import { ServiceCard } from '../../components/storefront/ServiceCard';
import { useApiResource } from '../../components/storefront/useApiResource';
import { useSettings } from '../../components/storefront/useSettings';

interface ServiceGroup {
  slug: string;
  name: string;
  services: ServiceDto[];
}

/** Groups services by category, keeping the API order for both groups and items. */
function groupByCategory(services: readonly ServiceDto[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();
  for (const service of services) {
    const existing = groups.get(service.category.slug);
    if (existing) existing.services.push(service);
    else
      groups.set(service.category.slug, {
        slug: service.category.slug,
        name: service.category.name,
        services: [service],
      });
  }
  return [...groups.values()];
}

/** /services: services grouped by category, each with duration, price and"Enquire on WhatsApp". */
export default function ServicesPage() {
  const settings = useSettings();
  const { data, error, loading, reload } = useApiResource<{ services: ServiceDto[] }>(
    '/api/services',
  );

  return (
    <section className="space-y-8 py-2" aria-labelledby="services-title">
      <header className="space-y-2">
        <h1
          id="services-title"
          className="font-display text-[2.6rem] leading-[1.05] font-medium text-ink-primary text-ink-primary"
        >
          {t('storefront.services.title')}
        </h1>
        <p className="text-body text-ink-muted">{t('storefront.services.intro')}</p>
      </header>

      {loading ? (
        <p role="status" className="text-ink-muted">
          {t('common.loading')}
        </p>
      ) : error ? (
        <Notice tone="error" onRetry={reload}>
          {errorMessage(error)}
        </Notice>
      ) : data && data.services.length > 0 ? (
        groupByCategory(data.services).map((group) => (
          <div key={group.slug} className="space-y-4">
            <h2 className="font-display text-[1.6rem] leading-tight font-medium text-ink-primary">
              {group.name}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {group.services.map((service) => (
                <ServiceCard key={service.id} service={service} settings={settings} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <Notice>{t('storefront.services.empty')}</Notice>
      )}
    </section>
  );
}
