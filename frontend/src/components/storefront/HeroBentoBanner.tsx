import { Link } from 'react-router';
import { t } from '../../i18n';
import { buttonClass } from '../ui/Button';

/**
 * Home hero: an asymmetric three-tile bento. The headline card is the LCP element and carries no
 * images. The other tiles are CSS gradients (no network requests) and are decorative.
 */
export function HeroBentoBanner({ headline }: { headline: string }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="grid gap-3 md:h-[30rem] md:grid-cols-[1.3fr_1fr_0.7fr] md:grid-rows-2 md:gap-4"
    >
      <div className="flex flex-col justify-end gap-6 rounded-[1.75rem] bg-sand p-6 md:row-span-2 md:p-12">
        <p className="font-ui text-[0.75rem] font-semibold tracking-[0.32em] text-ink-muted uppercase">
          {t('brand.name')}
        </p>
        <h1
          id="hero-heading"
          className="min-h-[10.75rem] font-display text-[2.6rem] leading-[1.02] font-medium text-ink-primary md:text-[4.25rem]"
        >
          {headline}
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link to="/products" className={buttonClass({ size: 'lg' })}>
            {t('storefront.hero.explore')}
          </Link>
          <Link to="/services" className={buttonClass({ variant: 'outline', size: 'lg' })}>
            {t('storefront.hero.bookSalon')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:hidden" aria-hidden="true">
        <div className="tile-sage h-28 rounded-[1.5rem]" />
        <div className="tile-sand h-28 rounded-[1.5rem]" />
      </div>
      <div
        aria-hidden="true"
        className="tile-sage hidden rounded-[1.75rem] md:row-span-2 md:block"
      />
      <div aria-hidden="true" className="tile-sand hidden rounded-[1.75rem] md:block" />
      <div aria-hidden="true" className="tile-sage hidden rounded-[1.75rem] md:block" />
    </section>
  );
}
