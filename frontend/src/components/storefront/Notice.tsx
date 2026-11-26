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
      className={`rounded-[1.25rem] border p-4 text-small ${
        tone === 'error'
          ? 'border-danger text-danger'
          : 'border-border-subtle bg-canvas text-ink-muted'
      }`}
    >
      <p>{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-pill border border-border-subtle px-4 font-medium text-ink-primary"
        >
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}
