import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  OrderStatusUpdateSchema,
  formatPaise,
  type OrderDto,
  type OrderStatus,
} from '@beauty-store/shared';
import { t } from '../../i18n';
import { apiGet, apiPatch } from '../../lib/api';
import { describeError } from '../../components/admin/adminErrors';
import { useAdminData } from '../../components/admin/useAdminData';
import {
  Notice,
  StatusBadge,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from '../../components/admin/ui';

const PER_PAGE = 20;
const FILTERS: (OrderStatus | 'all')[] = ['all', 'new', 'confirmed', 'delivered', 'cancelled'];

/** Server-enforced transitions (schema.md). Terminal states offer no moves. */
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

interface ListResponse {
  items: OrderDto[];
  page: number;
  per_page: number;
  total: number;
}

function parseFilter(value: string | null): OrderStatus | 'all' {
  return value === 'new' || value === 'confirmed' || value === 'delivered' || value === 'cancelled'
    ? value
    : 'all';
}

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams.get('status'));
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, error, loading, reload } = useAdminData<ListResponse>(
    (signal) => {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (filter !== 'all') params.set('status', filter);
      return apiGet<ListResponse>(`/api/admin/orders?${params.toString()}`, signal);
    },
    [filter, page],
  );

  function changeFilter(value: string) {
    setPage(1);
    setSearchParams(value === 'all' ? {} : { status: value });
  }

  async function move(order: OrderDto, status: OrderStatus) {
    const parsed = OrderStatusUpdateSchema.safeParse({ status });
    if (!parsed.success) return;
    setBusyId(order.id);
    setNotice(null);
    try {
      await apiPatch(`/api/admin/orders/${order.id}/status`, parsed.data);
      setNotice({ tone: 'success', text: t('admin.orders.updated') });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyId(null);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display font-semibold text-ink">{t('admin.orders.title')}</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="order-filter" className="text-small font-semibold text-ink">
            {t('admin.orders.filter')}
          </label>
          <select
            id="order-filter"
            className={`${inputClass} w-auto`}
            value={filter}
            onChange={(e) => changeFilter(e.target.value)}
          >
            {FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? t('admin.orders.all') : t(`admin.status.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {loading && !data ? (
        <p role="status" className="text-muted">
          {t('common.loading')}
        </p>
      ) : null}
      {error ? (
        <Notice tone="error">{describeError(error, 'admin.common.loadFailed')}</Notice>
      ) : null}

      {data && data.items.length === 0 ? (
        <p className="text-muted">{t('admin.orders.noOrders')}</p>
      ) : null}

      {data ? (
        <ul className="flex flex-col gap-4">
          {data.items.map((order) => {
            const moves = NEXT_STATUSES[order.status];
            return (
              <li
                key={order.id}
                className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-heading font-semibold">#{order.id}</p>
                  <StatusBadge status={order.status} label={t(`admin.status.${order.status}`)} />
                </div>
                <dl className="grid grid-cols-1 gap-2 text-small md:grid-cols-3">
                  <div>
                    <dt className="text-muted">{t('admin.orders.customer')}</dt>
                    <dd>{order.customer_name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t('admin.orders.phone')}</dt>
                    <dd>{order.customer_phone}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t('admin.orders.placed')}</dt>
                    <dd>{new Date(order.created_at).toLocaleString('en-IN')}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-muted">{t('admin.orders.address')}</dt>
                    <dd>{order.address}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t('admin.orders.total')}</dt>
                    <dd className="font-semibold">{formatPaise(order.total_paise)}</dd>
                  </div>
                </dl>
                <div className="text-small">
                  <p className="text-muted">{t('admin.orders.items')}</p>
                  <ul className="list-disc pl-5">
                    {order.items.map((item) => (
                      <li key={`${item.variant_id}-${item.product_id}`}>
                        {item.name} ({item.size}, {item.colour}) × {item.qty} ={' '}
                        {formatPaise(item.unit_price_paise * item.qty)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {moves.length === 0 ? (
                    <p className="text-small text-muted">{t('admin.orders.terminal')}</p>
                  ) : (
                    <>
                      <span className="text-small text-muted">{t('admin.orders.moveTo')}:</span>
                      {moves.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={status === 'cancelled' ? secondaryButtonClass : buttonClass}
                          disabled={busyId === order.id}
                          onClick={() => void move(order, status)}
                        >
                          {t(`admin.status.${status}`)}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {data ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('admin.common.previous')}
          </button>
          <p className="text-small text-muted">
            {t('admin.common.pageOf')
              .replace('{page}', String(page))
              .replace('{pages}', String(pages))}
          </p>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('admin.common.next')}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
