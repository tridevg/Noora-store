/** Joins class names, dropping falsy entries. Keeps component class strings readable. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
