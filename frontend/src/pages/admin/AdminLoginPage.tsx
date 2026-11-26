import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LoginSchema } from '@beauty-store/shared';
import { t } from '../../i18n';
import { ApiError, apiPost } from '../../lib/api';
import { describeError, zodFieldErrors } from '../../components/admin/adminErrors';
import { Field, Notice, buttonClass, inputClass } from '../../components/admin/ui';

const DEFAULT_RETRY_AFTER_SEC = 900;

/** Admin login. The shell's loader sends authenticated users straight to /admin. */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    const parsed = LoginSchema.safeParse({ username, password });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      // Login is the one admin POST without CSRF (schema.md). The cookie is issued by this response.
      await apiPost('/api/admin/login', parsed.data, { csrf: false });
      navigate('/admin', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const minutes = Math.ceil((error.retryAfter ?? DEFAULT_RETRY_AFTER_SEC) / 60);
        setNotice(t('admin.login.rateLimited').replace('{minutes}', String(minutes)));
      } else if (error instanceof ApiError && error.status === 401) {
        setNotice(t('admin.login.invalid'));
      } else {
        setNotice(describeError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="mb-6 text-display font-semibold text-ink">{t('admin.loginTitle')}</h1>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-5 shadow-card"
      >
        {notice ? <Notice tone="error">{notice}</Notice> : null}
        <Field id="admin-username" label={t('admin.login.username')} error={errors.username}>
          <input
            id="admin-username"
            name="username"
            autoComplete="username"
            className={inputClass}
            value={username}
            disabled={busy}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field id="admin-password" label={t('admin.login.password')} error={errors.password}>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button type="submit" className={buttonClass} disabled={busy}>
          {busy ? t('admin.login.submitting') : t('admin.login.submit')}
        </button>
      </form>
    </div>
  );
}
