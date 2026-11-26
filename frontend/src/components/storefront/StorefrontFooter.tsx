import { Link } from 'react-router';
import { t } from '../../i18n';

const FOOTER_LINK =
  'font-ui text-small font-medium text-ink-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover';

/** Site footer: wordmark and tagline, the four static pages, and the copyright line. */
export function StorefrontFooter() {
  return (
    <footer className="border-t border-border-subtle bg-sand">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 pb-24 md:grid-cols-3 md:pb-10">
        <div className="space-y-3">
          <p className="font-display text-[1.75rem] leading-none font-semibold tracking-[0.2em] text-ink-primary uppercase">
            {t('brand.name')}
          </p>
          <p className="font-ui text-small text-ink-muted">{t('footer.tagline')}</p>
        </div>
        <nav aria-label={t('nav.footerLabel')}>
          <ul className="grid grid-cols-2 gap-3">
            <li>
              <Link to="/about" className={FOOTER_LINK}>
                {t('footer.about')}
              </Link>
            </li>
            <li>
              <Link to="/contact" className={FOOTER_LINK}>
                {t('footer.contact')}
              </Link>
            </li>
            <li>
              <Link to="/shipping-returns" className={FOOTER_LINK}>
                {t('footer.shippingReturns')}
              </Link>
            </li>
            <li>
              <Link to="/privacy-policy" className={FOOTER_LINK}>
                {t('footer.privacyPolicy')}
              </Link>
            </li>
          </ul>
        </nav>
        <p className="font-ui text-small text-ink-muted md:text-right">
          © {new Date().getFullYear()} {t('brand.name')}. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
