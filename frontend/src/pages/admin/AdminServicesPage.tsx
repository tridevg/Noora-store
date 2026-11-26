import { useState, type FormEvent } from 'react';
import {
  ServiceCreateSchema,
  formatPaise,
  type CategoryDto,
  type ServiceDto,
} from '@beauty-store/shared';
import { t } from '../../i18n';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api';
import { describeError, zodFieldErrors } from '../../components/admin/adminErrors';
import { fetchCategories } from '../../components/admin/adminApi';
import { paiseToRupeesInput, parseRupeesToPaise } from '../../components/admin/money';
import { useAdminData } from '../../components/admin/useAdminData';
import {
  Field,
  Notice,
  Panel,
  buttonClass,
  dangerButtonClass,
  inputClass,
  secondaryButtonClass,
} from '../../components/admin/ui';

interface PageData {
  services: ServiceDto[];
  categories: CategoryDto[];
}

/** null = nothing open, 'new' = create form, number = edit that service. */
type Selection = number | 'new' | null;

export default function AdminServicesPage() {
  const [selection, setSelection] = useState<Selection>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const { data, error, loading, reload } = useAdminData<PageData>(async (signal) => {
    const [response, categories] = await Promise.all([
      apiGet<{ services: ServiceDto[] }>('/api/admin/services', signal),
      fetchCategories(signal, 'service'),
    ]);
    return { services: response.services, categories };
  }, []);

  function done(text: string) {
    setNotice({ tone: 'success', text });
    setSelection(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display font-semibold text-ink">{t('admin.services.title')}</h1>
        <button type="button" className={buttonClass} onClick={() => setSelection('new')}>
          {t('admin.services.newButton')}
        </button>
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

      {data && selection !== null ? (
        <Panel
          title={selection === 'new' ? t('admin.services.newTitle') : t('admin.services.editTitle')}
        >
          {selection === 'new' ? (
            <ServiceForm
              categories={data.categories}
              onSaved={() => done(t('admin.services.created'))}
              onCancel={() => setSelection(null)}
            />
          ) : (
            <ServiceEditor
              id={selection}
              categories={data.categories}
              onSaved={() => done(t('admin.services.saved'))}
              onDeleted={() => done(t('admin.services.deleted'))}
              onCancel={() => setSelection(null)}
            />
          )}
        </Panel>
      ) : null}

      {data ? (
        data.services.length === 0 ? (
          <p className="text-muted">{t('admin.common.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface-raised shadow-card">
            <table className="w-full text-left text-small">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t('admin.services.colName')}</th>
                  <th className="px-3 py-2 font-semibold">{t('admin.services.colPrice')}</th>
                  <th className="px-3 py-2 font-semibold">{t('admin.services.colDuration')}</th>
                  <th className="px-3 py-2 font-semibold">{t('admin.services.colStatus')}</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">{t('admin.services.edit')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.services.map((service) => (
                  <tr key={service.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{service.name}</td>
                    <td className="px-3 py-2">{formatPaise(service.price_paise)}</td>
                    <td className="px-3 py-2">
                      {service.duration_minutes} {t('admin.services.minutes')}
                    </td>
                    <td className="px-3 py-2">
                      {service.is_active ? t('admin.common.active') : t('admin.common.inactive')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="font-semibold text-accent"
                        onClick={() => setSelection(service.id)}
                      >
                        {t('admin.services.edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}

interface EditorProps {
  id: number;
  categories: CategoryDto[];
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

/** Loads one service with GET /api/admin/services/:id (includes inactive), then edits it. */
function ServiceEditor({ id, categories, onSaved, onDeleted, onCancel }: EditorProps) {
  const { data, error, loading } = useAdminData(
    (signal) => apiGet<{ service: ServiceDto }>(`/api/admin/services/${id}`, signal),
    [id],
  );

  if (loading && !data)
    return (
      <p role="status" className="text-muted">
        {t('common.loading')}
      </p>
    );
  if (error || !data)
    return <Notice tone="error">{describeError(error, 'admin.common.loadFailed')}</Notice>;

  return (
    <div className="flex flex-col gap-4">
      <ServiceForm
        initial={data.service}
        categories={categories}
        onSaved={onSaved}
        onCancel={onCancel}
      />
      <div>
        <DeleteServiceButton id={id} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

function DeleteServiceButton({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(t('admin.services.confirmDelete'))) return;
    setBusy(true);
    try {
      await apiDelete(`/api/admin/services/${id}`);
      onDeleted();
    } catch (error) {
      setMessage(describeError(error, 'admin.common.deleteFailed'));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {message ? <Notice tone="error">{message}</Notice> : null}
      <button
        type="button"
        className={dangerButtonClass}
        disabled={busy}
        onClick={() => void remove()}
      >
        {t('admin.common.delete')}
      </button>
    </div>
  );
}

interface FormProps {
  initial?: ServiceDto;
  categories: CategoryDto[];
  onSaved: () => void;
  onCancel: () => void;
}

function ServiceForm({ initial, categories, onSaved, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [categoryId, setCategoryId] = useState(String(initial?.category.id ?? ''));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial ? paiseToRupeesInput(initial.price_paise) : '');
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? ''));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const pricePaise = parseRupeesToPaise(price);
    const parsed = ServiceCreateSchema.safeParse({
      category_id: Number(categoryId),
      name,
      slug,
      description,
      price_paise: pricePaise ?? -1,
      duration_minutes: Number(duration),
      is_active: isActive,
    });
    if (!parsed.success || pricePaise === null) {
      const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
      if (pricePaise === null) fieldErrors.price_paise = t('admin.common.invalidAmount');
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    setNotice(null);
    try {
      if (initial) {
        await apiPut(`/api/admin/services/${initial.id}`, parsed.data);
      } else {
        await apiPost('/api/admin/services', parsed.data);
      }
      onSaved();
    } catch (error) {
      setNotice(describeError(error));
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
      <Field id="svc-name" label={t('admin.services.name')} error={errors.name}>
        <input
          id="svc-name"
          className={inputClass}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field id="svc-slug" label={t('admin.services.slug')} error={errors.slug}>
        <input
          id="svc-slug"
          className={inputClass}
          value={slug}
          disabled={busy}
          onChange={(e) => setSlug(e.target.value)}
        />
      </Field>
      <Field id="svc-category" label={t('admin.services.category')} error={errors.category_id}>
        <select
          id="svc-category"
          className={inputClass}
          value={categoryId}
          disabled={busy}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{t('admin.services.selectCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="svc-price"
          label={t('admin.services.price')}
          error={errors.price_paise}
          hint={t('admin.common.priceHelp')}
        >
          <input
            id="svc-price"
            inputMode="decimal"
            className={inputClass}
            value={price}
            disabled={busy}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field
          id="svc-duration"
          label={t('admin.services.duration')}
          error={errors.duration_minutes}
        >
          <input
            id="svc-duration"
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={duration}
            disabled={busy}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field
          id="svc-description"
          label={t('admin.services.description')}
          error={errors.description}
        >
          <textarea
            id="svc-description"
            rows={3}
            className={inputClass}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-small text-ink md:col-span-2">
        <input
          type="checkbox"
          checked={isActive}
          disabled={busy}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        {t('admin.common.active')}
      </label>
      <div className="flex gap-3 md:col-span-2">
        <button type="submit" className={buttonClass} disabled={busy}>
          {busy ? t('admin.common.saving') : t('admin.common.save')}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={busy}>
          {t('admin.common.cancel')}
        </button>
      </div>
    </form>
  );
}
