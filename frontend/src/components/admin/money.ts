// Rupee input helpers for admin forms. Money stays integer paise everywhere else.

/** Parses "1299", "1,299.5" or "1299.50" into paise. Returns null for anything else. */
export function parseRupeesToPaise(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim().replace(/,/g, ''));
  if (!match) return null;
  const rupees = Number(match[1] ?? '0');
  const paise = Number((match[2] ?? '').padEnd(2, '0'));
  const total = rupees * 100 + paise;
  return Number.isSafeInteger(total) ? total : null;
}

/** Formats paise as an input value with two decimals, e.g. 129950 -> "1299.50". */
export function paiseToRupeesInput(paise: number): string {
  return (paise / 100).toFixed(2);
}
