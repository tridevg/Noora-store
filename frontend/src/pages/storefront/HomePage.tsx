import { Link } from 'react-router';
import type { ServiceDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { HeroBentoBanner } from '../../components/storefront/HeroBentoBanner';
import { CategoryRail } from '../../components/storefront/CategoryRail';
import { NewArrivalsGrid } from '../../components/storefront/NewArrivalsGrid';
import { ServiceCard } from '../../components/storefront/ServiceCard';
import { useApiResource } from '../../components/storefront/useApiResource';
import { useSettings } from '../../components/storefront/useSettings';

const SERVICE_PREVIEW_COUNT = 4;

/**
 * Home: bento hero (the LCP headline), category rail, new arrivals and a services preview.
 * The hero headline is GET /api/settings banner_text when the admin sets one.
 */
export default function HomePage() {
  const settings = useSettings();
  const services = useApiResource<{ services: ServiceDto[] }>('/api/services');
  const serviceList = (services.data?.services ?? []).filter((s) => s.is_active !== false);

  return (
    <div className="space-y-16 pt-2 md:space-y-24 md:pt-6">
      <HeroBentoBanner headline={settings?.banner_text || t('storefront.hero.headline')} />
      <CategoryRail />
      <NewArrivalsGrid />

      {serviceList.length > 0 ? (
        <section aria-labelledby="services-heading" className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <h2
              id="services-heading"
              className="font-display text-[2rem] leading-tight font-medium text-ink-primary"
            >
              {t('storefront.home.servicesHeading')}
            </h2>
            <Link
              to="/services"
              className="font-ui text-small font-semibold text-sage-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover"
            >
              {t('storefront.home.viewAllServices')}
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {serviceList.slice(0, SERVICE_PREVIEW_COUNT).map((service) => (
              <ServiceCard key={service.id} service={service} settings={settings} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
