import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ProductCreateSchema,
  formatPaise,
  type AdminProductDto,
  type CategoryDto,
} from '@beauty-store/shared';
import { t } from '../../i18n';
import { apiGet, apiPost } from '../../lib/api';
import { describeError, zodFieldErrors } from '../../components/admin/adminErrors';
import { fetchCategories } from '../../components/admin/adminApi';
import { parseRupeesToPaise } from '../../components/admin/money';
import { useAdminData } from '../../components/admin/useAdminData';
import {
  Field,
  Notice,
  Panel,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from '../../components/admin/ui';

const PER_PAGE = 20;

interface ListResponse {
  items: AdminProductDto[];
  page: number;
  per_page: number;
  total: number;
}

interface PageData {
  list: ListResponse;
  categories: CategoryDto[];
}

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, error, loading } = useAdminData<PageData>(
    async (signal) => {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (search) params.set('q', search);
      const [list, categories] = await Promise.all([
        apiGet<ListResponse>(`/api/admin/products?${params.toString()}`, signal),
        fetchCategories(signal, 'product'),
      ]);
      return { list, categories };
    },
    [page, search],
  );

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }

  const pages = data ? Math.max(1, Math.ceil(data.list.total / PER_PAGE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display font-semibold text-ink">{t('admin.products.title')}</h1>
        <button type="button" className={buttonClass} onClick={() => setShowCreate((v) => !v)}>
          {t('admin.products.newButton')}
        </button>
      </div>

      {showCreate && data ? (
        <Panel title={t('admin.products.newTitle')}>
          <CreateProductForm
            categories={data.categories}
            onCreated={(id) => navigate(`/admin/products/${id}`)}
          />
        </Panel>
      ) : null}

      <form onSubmit={onSearch} className="flex gap-2" role="search">
        <label className="sr-only" htmlFor="product-search">
          {t('admin.common.search')}
        </label>
        <input
          id="product-search"
          type="search"
          className={`${inputClass} max-w-sm`}
          placeholder={t('admin.common.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className={secondaryButtonClass}>
          {t('admin.common.search')}
        </button>
      </form>

      {loading && !data ? (
        <p role="status" className="text-muted">
          {t('common.loading')}
        </p>
      ) : null}
      {error ? (
        <Notice tone="error">{describeError(error, 'admin.common.loadFailed')}</Notice>
      ) : null}

      {data ? (
        data.list.items.length === 0 ? (
          <p className="text-muted">{t('admin.common.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface-raised shadow-card">
            <table className="w-full text-left text-small">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t('admin.products.colName')}</th>
                  <th className="px-3 py-2 font-semibold">{t('admin.products.colPrice')}</th>
                  <th className="px-3 py-2 font-semibold">{t('admin.products.stockTotal')}</th>
                  <th className="px-3 py-2 font-semibold">{t('admin.products.colStatus')}</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">{t('admin.products.edit')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.list.items.map((product) => (
                  <tr key={product.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{product.name}</td>
                    <td className="px-3 py-2">{formatPaise(product.price_paise)}</td>
                    <td className="px-3 py-2">
                      {product.variants.reduce((sum, v) => sum + v.stock, 0)}
                    </td>
                    <td className="px-3 py-2">
                      {product.is_active ? t('admin.common.active') : t('admin.common.inactive')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="font-semibold text-accent"
                      >
                        {t('admin.products.edit')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
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

interface CreateProps {
  categories: CategoryDto[];
  onCreated: (id: number) => void;
}

function CreateProductForm({ categories, onCreated }: CreateProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const mrpPaise = parseRupeesToPaise(mrp);
    const pricePaise = parseRupeesToPaise(price);
    const parsed = ProductCreateSchema.safeParse({
      category_id: Number(categoryId),
      name,
      slug,
      mrp_paise: mrpPaise ?? -1,
      price_paise: pricePaise ?? -1,
      is_active: true,
    });
    if (!parsed.success) {
      const fieldErrors = zodFieldErrors(parsed.error);
      if (mrpPaise === null) fieldErrors.mrp_paise = t('admin.common.invalidAmount');
      if (pricePaise === null) fieldErrors.price_paise = t('admin.common.invalidAmount');
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    setNotice(null);
    try {
      const response = await apiPost<{ product: AdminProductDto }>(
        '/api/admin/products',
        parsed.data,
      );
      onCreated(response.product.id);
    } catch (error) {
      setNotice(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {notice ? (
        <div className="md:col-span-2">
          <Notice tone="error">{notice}</Notice>
        </div>
      ) : null}
      <Field id="new-name" label={t('admin.products.name')} error={errors.name}>
        <input
          id="new-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field id="new-slug" label={t('admin.products.slug')} error={errors.slug}>
        <input
          id="new-slug"
          className={inputClass}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </Field>
      <Field id="new-category" label={t('admin.products.category')} error={errors.category_id}>
        <select
          id="new-category"
          className={inputClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{t('admin.products.selectCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="new-mrp"
          label={t('admin.products.mrp')}
          error={errors.mrp_paise}
          hint={t('admin.common.priceHelp')}
        >
          <input
            id="new-mrp"
            inputMode="decimal"
            className={inputClass}
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
          />
        </Field>
        <Field id="new-price" label={t('admin.products.price')} error={errors.price_paise}>
          <input
            id="new-price"
            inputMode="decimal"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <button type="submit" className={buttonClass} disabled={busy}>
          {t('admin.common.create')}
        </button>
      </div>
    </form>
  );
}
