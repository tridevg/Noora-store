import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'discount' | 'stock' | 'soldOut' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  discount: 'bg-canvas text-ink-primary shadow-card',
  stock: 'bg-sage-tint text-ink-primary',
  soldOut: 'bg-ink-primary text-canvas',
  neutral: 'bg-sand text-ink-primary',
};

/** Small pill label. Colour pairs are checked for 4.5:1 text contrast. */
export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-1 font-ui text-[0.75rem] leading-none font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
