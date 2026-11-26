import { Link } from 'react-router';
import { formatPaise, type DashboardDto, type OrderStatus } from '@beauty-store/shared';
import { t } from '../../i18n';
import { apiGet } from '../../lib/api';
import { describeError } from '../../components/admin/adminErrors';
import { useAdminData } from '../../components/admin/useAdminData';
import { Notice, Panel, StatusBadge, secondaryButtonClass } from '../../components/admin/ui';

const STATUSES: OrderStatus[] = ['new', 'confirmed', 'delivered', 'cancelled'];

const countLabel: Record<OrderStatus, string> = {
  new: t('admin.dashboard.countNew'),
  confirmed: t('admin.dashboard.countConfirmed'),
  delivered: t('admin.dashboard.countDelivered'),
  cancelled: t('admin.dashboard.countCancelled'),
};

export default function AdminDashboardPage() {
  const { data, error, loading } = useAdminData(
    (signal) => apiGet<DashboardDto>('/api/admin/dashboard', signal),
    [],
  );

  if (loading && !data)
    return (
      <p role="status" className="text-muted">
        {t('common.loading')}
      </p>
    );
  if (error || !data) {
    return <Notice tone="error">{describeError(error, 'admin.common.loadFailed')}</Notice>;
  }

  const total = STATUSES.reduce((sum, status) => sum + (data.counts[status] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display font-semibold text-ink">{t('admin.dashboard.title')}</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Panel title={t('admin.dashboard.totalOrders')}>
          <p className="text-display font-semibold">{total}</p>
        </Panel>
        {STATUSES.map((status) => (
          <Panel key={status} title={countLabel[status]}>
            <p className="text-display font-semibold">{data.counts[status] ?? 0}</p>
          </Panel>
        ))}
      </div>

      <Panel title={t('admin.dashboard.recentOrders')}>
        {data.recent_orders.length === 0 ? (
          <p className="text-small text-muted">{t('admin.dashboard.noOrders')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-small">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">{t('admin.orders.customer')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('admin.orders.total')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('admin.orders.placed')}</th>
                  <th className="py-2 font-semibold">{t('admin.products.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="py-2 pr-3">{order.id}</td>
                    <td className="py-2 pr-3">{order.customer_name}</td>
                    <td className="py-2 pr-3">{formatPaise(order.total_paise)}</td>
                    <td className="py-2 pr-3">
                      {new Date(order.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2">
                      <StatusBadge
                        status={order.status}
                        label={t(`admin.status.${order.status}`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4">
          <Link to="/admin/orders" className={secondaryButtonClass}>
            {t('admin.dashboard.viewAll')}
          </Link>
        </div>
      </Panel>
    </div>
  );
}
