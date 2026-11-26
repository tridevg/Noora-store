import { t } from '../../i18n';
import { EditorialPage, EditorialSection } from '../../components/storefront/EditorialPage';

/** /privacy-policy: what an order collects, how it is used, and how long it is kept. */
export default function PrivacyPolicyPage() {
  return (
    <EditorialPage
      eyebrow={t('staticPages.privacy.eyebrow')}
      title={t('staticPages.privacy.title')}
      lead={t('staticPages.privacy.lead')}
    >
      <EditorialSection id="privacy-data" heading={t('staticPages.privacy.dataHeading')}>
        <p className="text-body text-ink">{t('staticPages.privacy.dataBody')}</p>
      </EditorialSection>
      <EditorialSection id="privacy-use" heading={t('staticPages.privacy.useHeading')}>
        <p className="text-body text-ink">{t('staticPages.privacy.useBody')}</p>
      </EditorialSection>
      <EditorialSection id="privacy-sharing" heading={t('staticPages.privacy.sharingHeading')}>
        <p className="text-body text-ink">{t('staticPages.privacy.sharingBody')}</p>
      </EditorialSection>
      <EditorialSection id="privacy-retention" heading={t('staticPages.privacy.retentionHeading')}>
        <p className="text-body text-ink">{t('staticPages.privacy.retentionBody')}</p>
      </EditorialSection>
      <EditorialSection id="privacy-choices" heading={t('staticPages.privacy.contactHeading')}>
        <p className="text-body text-ink">{t('staticPages.privacy.contactBody')}</p>
      </EditorialSection>
    </EditorialPage>
  );
}
