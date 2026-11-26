import { Link } from 'react-router';
import { t } from '../../i18n';
import { EditorialPage, EditorialSection } from '../../components/storefront/EditorialPage';

/** /about: short editorial story and values. Static copy from en.ts. */
export default function AboutPage() {
  return (
    <EditorialPage
      eyebrow={t('staticPages.about.eyebrow')}
      title={t('staticPages.about.title')}
      lead={t('staticPages.about.lead')}
    >
      <EditorialSection id="about-story" heading={t('staticPages.about.storyHeading')}>
        <p className="text-body text-ink-primary">{t('staticPages.about.storyBody')}</p>
      </EditorialSection>

      <EditorialSection id="about-values" heading={t('staticPages.about.valuesHeading')}>
        <ul className="grid gap-4 sm:grid-cols-3">
          <li className="space-y-2 rounded-[1.25rem] bg-sand p-4">
            <h3 className="font-semibold text-ink-primary">{t('staticPages.about.value1Title')}</h3>
            <p className="text-small text-ink-muted">{t('staticPages.about.value1Body')}</p>
          </li>
          <li className="space-y-2 rounded-[1.25rem] bg-sand p-4">
            <h3 className="font-semibold text-ink-primary">{t('staticPages.about.value2Title')}</h3>
            <p className="text-small text-ink-muted">{t('staticPages.about.value2Body')}</p>
          </li>
          <li className="space-y-2 rounded-[1.25rem] bg-sand p-4">
            <h3 className="font-semibold text-ink-primary">{t('staticPages.about.value3Title')}</h3>
            <p className="text-small text-ink-muted">{t('staticPages.about.value3Body')}</p>
          </li>
        </ul>
      </EditorialSection>

      <section aria-labelledby="about-cta" className="space-y-4 rounded-[1.25rem] bg-sand p-6">
        <h2
          id="about-cta"
          className="font-display text-[1.6rem] leading-tight font-medium text-ink-primary"
        >
          {t('staticPages.about.ctaHeading')}
        </h2>
        <p className="text-body text-ink-muted">{t('staticPages.about.ctaBody')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/products"
            className="inline-flex min-h-12 items-center rounded-pill bg-sage-hover px-6 font-semibold text-white"
          >
            {t('staticPages.about.ctaShop')}
          </Link>
          <Link
            to="/contact"
            className="inline-flex min-h-12 items-center rounded-pill border border-border-subtle px-6 font-semibold text-ink-primary"
          >
            {t('staticPages.about.ctaContact')}
          </Link>
        </div>
      </section>
    </EditorialPage>
  );
}
