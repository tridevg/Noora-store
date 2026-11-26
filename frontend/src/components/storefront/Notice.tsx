import type { ReactNode } from 'react';
import { t } from '../../i18n';

/** Inline status box for empty states and errors. Errors use role="alert"; empty states use plain text. */
export function Notice({
  tone = 'info',
  children,
  onRetry,
}: {
  tone?: 'info' | 'error';
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-card border p-4 text-small ${
        tone === 'error'
          ? 'border-danger text-danger'
          : 'border-border bg-surface-raised text-muted'
      }`}
    >
      <p>{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-pill border border-border px-4 font-medium text-ink"
        >
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}
