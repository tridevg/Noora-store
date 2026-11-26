import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { t } from '../../i18n';
import { apiPost } from '../../lib/api';
import { secondaryButtonClass } from '../../components/admin/ui';

// Admin layout: no storefront chrome. Child routes render in the Outlet.
// The session guard is the route loader in App.tsx (GET /api/admin/session).
const links = [
  { to: '/admin', label: t('admin.nav.dashboard'), end: true },
  { to: '/admin/products', label: t('admin.nav.products'), end: false },
  { to: '/admin/services', label: t('admin.nav.services'), end: false },
  { to: '/admin/orders', label: t('admin.nav.orders'), end: false },
  { to: '/admin/settings', label: t('admin.nav.settings'), end: false },
];

export default function AdminShellPage() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      // Logout is session+csrf (schema.md). A 401 here still means "logged out".
      await apiPost('/api/admin/logout');
    } catch {
      // Ignored: the cookie is cleared server-side or the session already expired.
    } finally {
      navigate('/admin/login', { replace: true });
    }
  }

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <p className="text-heading font-semibold">{t('admin.shellTitle')}</p>
          <nav aria-label={t('admin.shellTitle')} className="flex flex-1 flex-wrap gap-4">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `text-small ${isActive ? 'font-semibold text-accent' : 'text-muted'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={loggingOut}
            onClick={() => void logout()}
          >
            {t('admin.nav.logout')}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
