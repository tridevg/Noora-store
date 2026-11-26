import type { ReactNode } from 'react';

export const inputClass =
  'w-full rounded-card border border-border bg-surface-raised px-3 py-2 text-body text-ink disabled:opacity-60';
export const buttonClass =
  'inline-flex items-center justify-center rounded-pill bg-accent px-4 py-2 text-small font-semibold text-accent-ink disabled:opacity-60';
export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-pill border border-border bg-surface-raised px-4 py-2 text-small font-semibold text-ink disabled:opacity-60';
export const dangerButtonClass =
  'inline-flex items-center justify-center rounded-pill border border-danger px-4 py-2 text-small font-semibold text-danger disabled:opacity-60';

interface FieldProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}

/** Label, control and messages for one form field. Pass the control with id={id}. */
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-small text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Inline success or error message. */
export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-card border bg-surface-raised px-3 py-2 text-small ${
        tone === 'error' ? 'border-danger text-danger' : 'border-border text-ink'
      }`}
    >
      {children}
    </p>
  );
}

/** Card with a heading. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface-raised p-4 shadow-card">
      <h2 className="mb-3 text-heading font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const statusTone: Record<string, string> = {
  new: 'bg-accent text-accent-ink',
  confirmed: 'border border-border bg-surface text-ink',
  delivered: 'border border-border bg-surface text-muted',
  cancelled: 'border border-danger text-danger',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-block rounded-pill px-2 py-0.5 text-small font-semibold ${statusTone[status] ?? ''}`}
    >
      {label}
    </span>
  );
}
