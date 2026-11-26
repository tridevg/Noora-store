import { useState, type FormEvent } from 'react';
import { VariantCreateSchema, VariantUpdateSchema, type VariantDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { apiDelete, apiPost, apiPut } from '../../lib/api';
import { describeError, serverFieldErrors, zodFieldErrors } from './adminErrors';
import {
  Field,
  Notice,
  buttonClass,
  dangerButtonClass,
  inputClass,
  secondaryButtonClass,
} from './ui';

interface Props {
  productId: number;
  variants: VariantDto[];
  onChanged: () => void;
}

interface Draft {
  size: string;
  colour: string;
  sku: string;
  stock: string;
}

const emptyDraft: Draft = { size: '', colour: '', sku: '', stock: '0' };

type Message = { tone: 'error' | 'success'; text: string } | null;

/** Lists variants with inline stock editing, plus an add form and remove. */
export function ProductVariantManager({ productId, variants, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      onChanged();
    } catch (error) {
      setMessage({ tone: 'error', text: describeError(error) });
      setErrors(serverFieldErrors(error));
    } finally {
      setBusy(false);
    }
  }

  function addVariant(event: FormEvent) {
    event.preventDefault();
    const parsed = VariantCreateSchema.safeParse({
      size: draft.size,
      colour: draft.colour,
      sku: draft.sku,
      stock: Number(draft.stock || '0'),
    });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    void run(async () => {
      await apiPost(`/api/admin/products/${productId}/variants`, parsed.data);
      setDraft(emptyDraft);
    }, t('admin.editor.variantAdded'));
  }

  function saveStock(variant: VariantDto) {
    const raw = stockDrafts[variant.id] ?? String(variant.stock);
    const parsed = VariantUpdateSchema.safeParse({ stock: Number(raw) });
    if (!parsed.success) {
      setMessage({ tone: 'error', text: t('errors.validation') });
      return;
    }
    void run(async () => {
      await apiPut(`/api/admin/variants/${variant.id}`, parsed.data);
      setStockDrafts((prev) => {
        const next = { ...prev };
        delete next[variant.id];
        return next;
      });
    }, t('admin.editor.variantSaved'));
  }

  function removeVariant(variant: VariantDto) {
    if (!window.confirm(t('admin.common.confirmDelete'))) return;
    void run(
      () => apiDelete(`/api/admin/variants/${variant.id}`),
      t('admin.editor.variantDeleted'),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {variants.length === 0 ? (
        <p className="text-small text-muted">{t('admin.editor.noVariants')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-small">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">{t('admin.editor.colSize')}</th>
                <th className="py-2 pr-3 font-semibold">{t('admin.editor.colColour')}</th>
                <th className="py-2 pr-3 font-semibold">{t('admin.editor.colSku')}</th>
                <th className="py-2 pr-3 font-semibold">{t('admin.editor.colStock')}</th>
                <th className="py-2 font-semibold">
                  <span className="sr-only">{t('admin.common.edit')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id} className="border-t border-border">
                  <td className="py-2 pr-3">{variant.size}</td>
                  <td className="py-2 pr-3">{variant.colour}</td>
                  <td className="py-2 pr-3 font-mono">{variant.sku}</td>
                  <td className="py-2 pr-3">
                    <label className="sr-only" htmlFor={`stock-${variant.id}`}>
                      {t('admin.editor.colStock')}
                    </label>
                    <input
                      id={`stock-${variant.id}`}
                      type="number"
                      min={0}
                      step={1}
                      disabled={busy}
                      className={`${inputClass} w-24`}
                      value={stockDrafts[variant.id] ?? String(variant.stock)}
                      onChange={(e) =>
                        setStockDrafts((prev) => ({ ...prev, [variant.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        disabled={busy}
                        onClick={() => saveStock(variant)}
                      >
                        {t('admin.editor.saveStock')}
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        disabled={busy}
                        onClick={() => removeVariant(variant)}
                      >
                        {t('admin.editor.removeVariant')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={addVariant} noValidate className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Field id="variant-size" label={t('admin.editor.size')} error={errors.size}>
          <input
            id="variant-size"
            className={inputClass}
            disabled={busy}
            value={draft.size}
            onChange={(e) => setDraft({ ...draft, size: e.target.value })}
          />
        </Field>
        <Field id="variant-colour" label={t('admin.editor.colour')} error={errors.colour}>
          <input
            id="variant-colour"
            className={inputClass}
            disabled={busy}
            value={draft.colour}
            onChange={(e) => setDraft({ ...draft, colour: e.target.value })}
          />
        </Field>
        <Field id="variant-sku" label={t('admin.editor.sku')} error={errors.sku}>
          <input
            id="variant-sku"
            className={inputClass}
            disabled={busy}
            value={draft.sku}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
          />
        </Field>
        <Field id="variant-stock" label={t('admin.editor.stock')} error={errors.stock}>
          <input
            id="variant-stock"
            type="number"
            min={0}
            step={1}
            className={inputClass}
            disabled={busy}
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
          />
        </Field>
        <div className="flex items-end">
          <button type="submit" className={buttonClass} disabled={busy}>
            {t('admin.editor.addVariant')}
          </button>
        </div>
      </form>
    </div>
  );
}
