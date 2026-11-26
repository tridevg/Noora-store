import { cn } from './cn';

/** Hairline divider. Decorative, so it is hidden from assistive tech unless it separates regions. */
export function Separator({
  orientation = 'horizontal',
  tone = 'light',
  className,
}: {
  orientation?: 'horizontal' | 'vertical';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <div
      role="none"
      aria-hidden="true"
      className={cn(
        tone === 'dark' ? 'bg-drawer-line' : 'bg-border-subtle',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  );
}
