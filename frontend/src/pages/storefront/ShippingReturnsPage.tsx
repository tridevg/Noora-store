import { t } from '../../i18n';
import { EditorialPage, EditorialSection } from '../../components/storefront/EditorialPage';

/** /shipping-returns: delivery, payment on delivery, and the returns window. */
export default function ShippingReturnsPage() {
  return (
    <EditorialPage
      eyebrow={t('staticPages.shipping.eyebrow')}
      title={t('staticPages.shipping.title')}
      lead={t('staticPages.shipping.lead')}
    >
      <EditorialSection id="shipping-delivery" heading={t('staticPages.shipping.deliveryHeading')}>
        <p className="text-body text-ink">{t('staticPages.shipping.deliveryBody')}</p>
      </EditorialSection>
      <EditorialSection id="shipping-payment" heading={t('staticPages.shipping.paymentHeading')}>
        <p className="text-body text-ink">{t('staticPages.shipping.paymentBody')}</p>
      </EditorialSection>
      <EditorialSection id="shipping-returns" heading={t('staticPages.shipping.returnsHeading')}>
        <p className="text-body text-ink">{t('staticPages.shipping.returnsBody')}</p>
      </EditorialSection>
      <EditorialSection id="shipping-questions" heading={t('staticPages.shipping.contactHeading')}>
        <p className="text-body text-muted">{t('staticPages.shipping.contactBody')}</p>
      </EditorialSection>
    </EditorialPage>
  );
}
