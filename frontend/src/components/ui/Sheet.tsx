import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../layout/useFocusTrap';
import { cn } from './cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading. The dialog is labelled by it. */
  title: string;
  /** Accessible name of the close button, passed in so this primitive has no copy of its own. */
  closeLabel: string;
  tone?: 'light' | 'dark';
  children: ReactNode;
}

/**
 * Right-hand slide-over dialog. Modal: focus is trapped inside, Escape closes, focus returns to the
 * element that opened it, and page scroll is locked while open.
 */
export function Sheet({ open, onClose, title, closeLabel, tone = 'light', children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;
  const dark = tone === 'dark';
  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-ink-primary/45" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-md flex-col shadow-card focus:outline-none',
          dark ? 'bg-drawer-dark text-canvas' : 'bg-canvas text-ink-primary',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-3 border-b px-5 py-4',
            dark ? 'border-drawer-line' : 'border-border-subtle',
          )}
        >
          <h2 id={titleId} className="font-display text-[1.6rem] leading-none font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex min-h-11 items-center rounded-pill px-4 font-ui text-small font-semibold focus-visible:outline-2 focus-visible:outline-offset-2',
              dark
                ? 'text-canvas hover:bg-drawer-surface focus-visible:outline-canvas'
                : 'text-ink-primary hover:bg-sand focus-visible:outline-sage-hover',
            )}
          >
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
