// Money is integer paise only. Floats never reach this module's arithmetic.

function assertPaise(value: number, label = 'paise'): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer, got ${String(value)}`);
  }
}

// Indian digit grouping: last three digits, then groups of two (1,00,000).
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const groups: string[] = [];
  for (let end = head.length; end > 0; end -= 2) {
    groups.unshift(head.slice(Math.max(0, end - 2), end));
  }
  return `${groups.join(',')},${tail}`;
}

/** Formats integer paise as an INR string: 129900 -> "₹1,299", 129950 -> "₹1,299.50". */
export function formatPaise(paise: number): string {
  assertPaise(paise);
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  const base = `₹${groupIndian(String(rupees))}`;
  return remainder === 0 ? base : `${base}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Integer percentage discount, rounded half-up, clamped to 0..100.
 * Returns 0 when mrp is 0. Uses integer arithmetic only.
 */
export function percentOff(mrpPaise: number, pricePaise: number): number {
  assertPaise(mrpPaise, 'mrpPaise');
  assertPaise(pricePaise, 'pricePaise');
  if (mrpPaise === 0) return 0;
  const scaled = (mrpPaise - pricePaise) * 100;
  // floor(scaled / mrp + 1/2) computed as an integer division.
  const rounded = Math.floor((2 * scaled + mrpPaise) / (2 * mrpPaise));
  return Math.min(100, Math.max(0, rounded));
}

/** Sums integer paise values. Every element must be a non-negative integer. */
export function sumPaise(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    assertPaise(value);
    total += value;
  }
  assertPaise(total, 'sum');
  return total;
}
