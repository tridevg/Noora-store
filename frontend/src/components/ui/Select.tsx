import type { SelectHTMLAttributes } from 'react';
import { cn } from './cn';

/** Native select with the storefront field look. Native keeps it accessible and fast on phones. */
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'min-h-11 rounded-card border border-border-subtle bg-canvas px-3 font-ui text-small text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover',
        className,
      )}
      {...rest}
    />
  );
}
