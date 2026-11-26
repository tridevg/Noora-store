import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'light';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill font-ui font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-hover disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  // White on sage-hover is 5.48:1, so the label passes WCAG AA.
  primary: 'bg-sage-hover text-white hover:bg-sage-pressed',
  outline: 'border border-ink-primary/25 bg-canvas text-ink-primary hover:bg-sand',
  ghost: 'text-ink-primary hover:bg-sand',
  // For the dark bag drawer.
  light: 'bg-canvas text-ink-primary hover:bg-sand',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 text-small',
  md: 'min-h-11 px-5 text-small',
  lg: 'min-h-12 px-6 text-body',
};

/** Class string for a button look. Use it on Links so navigation and actions look the same. */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Native button with the storefront look. type defaults to "button" so it never submits a form by accident. */
export function Button({ variant, size, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...rest} />;
}
