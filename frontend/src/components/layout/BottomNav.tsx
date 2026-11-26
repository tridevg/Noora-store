import { NavLink } from 'react-router';
import { t } from '../../i18n';
import { useCart } from '../../cart';

interface BottomNavProps {
  /** wa.me link, or null to hide the WhatsApp item. */
  whatsappHref: string | null;
}

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center text-small ${
    isActive ? 'font-semibold text-accent' : 'text-muted'
  }`;

/** Fixed bottom navigation for small screens: Home | Categories | Services | Cart | WhatsApp. */
export function BottomNav({ whatsappHref }: BottomNavProps) {
  const { itemCount } = useCart();
  return (
    <nav
      aria-label={t('nav.primaryLabel')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        <li className="flex flex-1">
          <NavLink to="/" end className={itemClass}>
            {t('nav.home')}
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/#categories" className={itemClass}>
            {t('nav.categories')}
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/services" className={itemClass}>
            {t('nav.services')}
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/cart" className={itemClass}>
            {t('nav.cart')}
            {itemCount > 0 ? <span className="sr-only">, {itemCount}</span> : null}
            {itemCount > 0 ? (
              <span aria-hidden="true" className="text-[0.7rem] text-accent">
                {itemCount}
              </span>
            ) : null}
          </NavLink>
        </li>
        {whatsappHref ? (
          <li className="flex flex-1">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('whatsapp.fabLabel')}
              className="flex min-h-14 flex-1 flex-col items-center justify-center text-small text-muted"
            >
              {t('nav.whatsapp')}
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
