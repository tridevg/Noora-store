import { NavLink } from 'react-router';
import { t } from '../../i18n';
import { useCart } from '../../cart';
import { useBag } from '../storefront/BagProvider';
import { BagIcon } from '../storefront/icons';

interface BottomNavProps {
  /** wa.me link, or null to hide the WhatsApp item. */
  whatsappHref: string | null;
}

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 font-ui text-[0.75rem] font-medium ${
    isActive ? 'text-sage-hover' : 'text-ink-muted'
  }`;

/** Fixed bottom navigation for small screens: Home | Categories | Services | Bag | WhatsApp. */
export function BottomNav({ whatsappHref }: BottomNavProps) {
  const { itemCount } = useCart();
  const { openBag } = useBag();
  return (
    <nav
      aria-label={t('nav.primaryLabel')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
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
          <button
            type="button"
            onClick={openBag}
            aria-haspopup="dialog"
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 font-ui text-[0.75rem] font-medium text-ink-muted"
          >
            <span className="relative inline-flex">
              <BagIcon className="size-5" />
              {itemCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2.5 inline-flex min-w-4 items-center justify-center rounded-pill bg-sage-hover px-1 text-[0.65rem] leading-4 text-white"
                >
                  {itemCount}
                </span>
              ) : null}
            </span>
            {itemCount > 0 ? (
              <span className="sr-only">
                {t('nav.bag')}, {itemCount}
              </span>
            ) : null}
            <span aria-hidden={itemCount > 0 ? true : undefined}>{t('nav.bag')}</span>
          </button>
        </li>
        {/* Keep the slot while settings load, so Bag does not move when the WhatsApp item appears. */}
        {whatsappHref ? (
          <li className="flex flex-1">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('whatsapp.fabLabel')}
              className="flex min-h-14 flex-1 flex-col items-center justify-center font-ui text-[0.75rem] font-medium text-ink-muted"
            >
              {t('nav.whatsapp')}
            </a>
          </li>
        ) : (
          <li aria-hidden="true" className="flex flex-1" />
        )}
      </ul>
    </nav>
  );
}
