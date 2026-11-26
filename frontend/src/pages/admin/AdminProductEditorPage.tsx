import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ProductUpdateSchema, type AdminProductDto, type CategoryDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { apiDelete, apiGet, apiPut } from '../../lib/api';
import { describeError, zodFieldErrors } from '../../components/admin/adminErrors';
import { fetchCategories } from '../../components/admin/adminApi';
import { paiseToRupeesInput, parseRupeesToPaise } from '../../components/admin/money';
import { ProductImageUploader } from '../../components/admin/ProductImageUploader';
import { ProductVariantManager } from '../../components/admin/ProductVariantManager';
import { useAdminData } from '../../components/admin/useAdminData';
import {
  Field,
  Notice,
  Panel,
  buttonClass,
  dangerButtonClass,
  inputClass,
} from '../../components/admin/ui';

interface EditorData {
  product: AdminProductDto;
  categories: CategoryDto[];
}

export default function AdminProductEditorPage() {
  const params = useParams();
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;
  const navigate = useNavigate();

  const { data, error, loading, reload } = useAdminData<EditorData>(
    async (signal) => {
      const [response, categories] = await Promise.all([
        apiGet<{ product: AdminProductDto }>(`/api/admin/products/${id}`, signal),
        fetchCategories(signal, 'product'),
      ]);
      return { product: response.product, categories };
    },
    [id],
  );

  if (!validId) return <Notice tone="error">{t('admin.common.notFound')}</Notice>;
  if (loading && !data)
    return (
      <p role="status" className="text-muted">
        {t('common.loading')}
      </p>
    );
  if (error || !data) {
    return <Notice tone="error">{describeError(error, 'admin.common.loadFailed')}</Notice>;
  }

  const { product, categories } = data;

  async function removeProduct() {
    if (!window.confirm(t('admin.products.confirmDelete'))) return;
    try {
      await apiDelete(`/api/admin/products/${id}`);
      navigate('/admin/products', { replace: true });
    } catch (err) {
      window.alert(describeError(err, 'admin.common.deleteFailed'));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display font-semibold text-ink">{product.name}</h1>
        <button type="button" className={dangerButtonClass} onClick={() => void removeProduct()}>
          {t('admin.products.delete')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title={t('admin.editor.details')}>
          <DetailsForm product={product} categories={categories} onSaved={reload} />
        </Panel>

        <Panel title={t('admin.editor.variants')}>
          <ProductVariantManager productId={id} variants={product.variants} onChanged={reload} />
        </Panel>
      </div>

      <Panel title={t('admin.editor.images')}>
        <ProductImageUploader productId={id} images={product.images} onChanged={reload} />
      </Panel>
    </div>
  );
}

interface DetailsProps {
  product: AdminProductDto;
  categories: CategoryDto[];
  onSaved: () => void;
}

/** Initialised once from the loaded product. The page reload keeps this form mounted. */
function DetailsForm({ product, categories, onSaved }: DetailsProps) {
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [categoryId, setCategoryId] = useState(String(product.category_id));
  const [description, setDescription] = useState(product.description);
  const [tags, setTags] = useState(product.tags);
  const [mrp, setMrp] = useState(paiseToRupeesInput(product.mrp_paise));
  const [price, setPrice] = useState(paiseToRupeesInput(product.price_paise));
  const [isActive, setIsActive] = useState(product.is_active);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const mrpPaise = parseRupeesToPaise(mrp);
    const pricePaise = parseRupeesToPaise(price);
    const parsed = ProductUpdateSchema.safeParse({
      name,
      slug,
      category_id: Number(categoryId),
      description,
      tags,
      mrp_paise: mrpPaise ?? -1,
      price_paise: pricePaise ?? -1,
      is_active: isActive,
    });
    if (!parsed.success || mrpPaise === null || pricePaise === null) {
      const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
      if (mrpPaise === null) fieldErrors.mrp_paise = t('admin.common.invalidAmount');
      if (pricePaise === null) fieldErrors.price_paise = t('admin.common.invalidAmount');
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    setNotice(null);
    try {
      await apiPut(`/api/admin/products/${product.id}`, parsed.data);
      setNotice({ tone: 'success', text: t('admin.products.saved') });
      onSaved();
    } catch (error) {
      setNotice({ tone: 'error', text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      <Field id="edit-name" label={t('admin.products.name')} error={errors.name}>
        <input
          id="edit-name"
          className={inputClass}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field id="edit-slug" label={t('admin.products.slug')} error={errors.slug}>
        <input
          id="edit-slug"
          className={inputClass}
          value={slug}
          disabled={busy}
          onChange={(e) => setSlug(e.target.value)}
        />
      </Field>
      <Field id="edit-category" label={t('admin.products.category')} error={errors.category_id}>
        <select
          id="edit-category"
          className={inputClass}
          value={categoryId}
          disabled={busy}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="edit-mrp"
          label={t('admin.products.mrp')}
          error={errors.mrp_paise}
          hint={t('admin.common.priceHelp')}
        >
          <input
            id="edit-mrp"
            inputMode="decimal"
            className={inputClass}
            value={mrp}
            disabled={busy}
            onChange={(e) => setMrp(e.target.value)}
          />
        </Field>
        <Field id="edit-price" label={t('admin.products.price')} error={errors.price_paise}>
          <input
            id="edit-price"
            inputMode="decimal"
            className={inputClass}
            value={price}
            disabled={busy}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
      </div>
      <Field
        id="edit-description"
        label={t('admin.products.description')}
        error={errors.description}
      >
        <textarea
          id="edit-description"
          rows={4}
          className={inputClass}
          value={description}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field id="edit-tags" label={t('admin.products.tags')} error={errors.tags}>
        <input
          id="edit-tags"
          className={inputClass}
          value={tags}
          disabled={busy}
          onChange={(e) => setTags(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-small text-ink">
        <input
          type="checkbox"
          checked={isActive}
          disabled={busy}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        {t('admin.editor.activeToggle')}
      </label>
      <div>
        <button type="submit" className={buttonClass} disabled={busy}>
          {busy ? t('admin.common.saving') : t('admin.common.save')}
        </button>
      </div>
    </form>
  );
}
