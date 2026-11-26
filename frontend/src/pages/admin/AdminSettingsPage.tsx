import { useState, type FormEvent } from 'react';
import { SettingsUpdateSchema, type SettingsMap } from '@beauty-store/shared';
import { t } from '../../i18n';
import { apiGet, apiPut } from '../../lib/api';
import { describeError, zodFieldErrors } from '../../components/admin/adminErrors';
import { useAdminData } from '../../components/admin/useAdminData';
import { Field, Notice, buttonClass, inputClass } from '../../components/admin/ui';

const EMPTY: SettingsMap = {
  business_name: '',
  whatsapp_number: '',
  address: '',
  opening_hours: '',
  banner_text: '',
};

export default function AdminSettingsPage() {
  // Public read: schema.md has no admin GET for settings. The public response is cached
  // for 300 s, and every admin settings save purges it, so the values shown are current.
  const { data, error, loading, reload } = useAdminData(
    (signal) => apiGet<{ settings: SettingsMap }>('/api/settings', signal),
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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-display font-semibold text-ink">{t('admin.settings.title')}</h1>
      <p className="text-small text-muted">{t('admin.settings.help')}</p>
      <SettingsForm
        key={JSON.stringify(data.settings)}
        initial={{ ...EMPTY, ...data.settings }}
        onSaved={reload}
      />
    </div>
  );
}

function SettingsForm({ initial, onSaved }: { initial: SettingsMap; onSaved: () => void }) {
  const [values, setValues] = useState<SettingsMap>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof SettingsMap>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = SettingsUpdateSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    setNotice(null);
    try {
      await apiPut('/api/admin/settings', parsed.data);
      setNotice({ tone: 'success', text: t('admin.common.saved') });
      onSaved();
    } catch (error) {
      setNotice({ tone: 'error', text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }

  const fields: { key: keyof SettingsMap; label: string; multiline?: boolean }[] = [
    { key: 'business_name', label: t('admin.settings.businessName') },
    { key: 'whatsapp_number', label: t('admin.settings.whatsappNumber') },
    { key: 'address', label: t('admin.settings.address'), multiline: true },
    { key: 'opening_hours', label: t('admin.settings.openingHours') },
    { key: 'banner_text', label: t('admin.settings.bannerText') },
  ];

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-5 shadow-card"
    >
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {fields.map((field) => (
        <Field
          key={field.key}
          id={`setting-${field.key}`}
          label={field.label}
          error={errors[field.key]}
        >
          {field.multiline ? (
            <textarea
              id={`setting-${field.key}`}
              rows={3}
              className={inputClass}
              value={values[field.key]}
              disabled={busy}
              onChange={(e) => set(field.key, e.target.value)}
            />
          ) : (
            <input
              id={`setting-${field.key}`}
              className={inputClass}
              value={values[field.key]}
              disabled={busy}
              onChange={(e) => set(field.key, e.target.value)}
            />
          )}
        </Field>
      ))}
      <div>
        <button type="submit" className={buttonClass} disabled={busy}>
          {busy ? t('admin.common.saving') : t('admin.common.save')}
        </button>
      </div>
    </form>
  );
}
