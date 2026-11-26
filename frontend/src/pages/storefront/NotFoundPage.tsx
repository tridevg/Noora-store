import { Link } from 'react-router';
import { t } from '../../i18n';

/** Unknown route inside the storefront chrome. Offers the three most useful destinations. */
export default function NotFoundPage() {
  const links = [
    { to: '/products', label: t('staticPages.notFound.shop') },
    { to: '/services', label: t('staticPages.notFound.services') },
    { to: '/contact', label: t('staticPages.notFound.contact') },
  ];
  return (
    <section
      aria-labelledby="not-found-title"
      className="mx-auto max-w-2xl space-y-6 py-10 text-center"
    >
      <p aria-hidden="true" className="font-semibold text-accent text-7xl">
        {t('staticPages.notFound.code')}
      </p>
      <h1 id="not-found-title" className="text-display font-semibold text-ink">
        {t('staticPages.notFound.title')}
      </h1>
      <p className="text-body text-muted">{t('staticPages.notFound.body')}</p>
      <ul className="flex flex-wrap justify-center gap-3">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="inline-flex min-h-12 items-center rounded-pill border border-border bg-surface-raised px-5 font-medium text-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <Link to="/" className="text-small font-medium text-accent underline">
          {t('notFound.backHome')}
        </Link>
      </p>
    </section>
  );
}
