// Pure cart helpers. All money is integer paise (shared formatPaise / sumPaise).
import { sumPaise } from '@beauty-store/shared';

export interface CartLine {
  productId: number;
  variantId: number;
  slug: string;
  name: string;
  size: string;
  colour: string;
  unitPricePaise: number;
  qty: number;
}

export const CART_STORAGE_KEY = 'bs_cart_v1';
export const MAX_LINE_QTY = 20;

function clampQty(qty: number): number {
  return Math.min(MAX_LINE_QTY, Math.max(0, Math.trunc(qty)));
}

/** Adds a line. Merges into an existing line with the same variantId; qty is capped at 20. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const qty = clampQty(line.qty);
  if (qty === 0) return lines;
  const existing = lines.find((item) => item.variantId === line.variantId);
  if (!existing) return [...lines, { ...line, qty }];
  return lines.map((item) =>
    item.variantId === line.variantId ? { ...item, qty: clampQty(item.qty + qty) } : item,
  );
}

/** Sets a line's qty. qty 0 (or less) removes the line; values above 20 are capped. */
export function setQty(lines: CartLine[], variantId: number, qty: number): CartLine[] {
  const next = clampQty(qty);
  if (next === 0) return removeLine(lines, variantId);
  return lines.map((item) => (item.variantId === variantId ? { ...item, qty: next } : item));
}

export function removeLine(lines: CartLine[], variantId: number): CartLine[] {
  return lines.filter((item) => item.variantId !== variantId);
}

/** Paise for one line: unit price times qty. */
export function lineTotalPaise(line: CartLine): number {
  return line.unitPricePaise * line.qty;
}

export function subtotalPaise(lines: CartLine[]): number {
  return sumPaise(lines.map(lineTotalPaise));
}

export function itemCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.qty, 0);
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const isNonNegInt = (n: unknown): n is number =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  return (
    isNonNegInt(v.productId) &&
    isNonNegInt(v.variantId) &&
    typeof v.slug === 'string' &&
    typeof v.name === 'string' &&
    typeof v.size === 'string' &&
    typeof v.colour === 'string' &&
    isNonNegInt(v.unitPricePaise) &&
    typeof v.qty === 'number' &&
    Number.isSafeInteger(v.qty) &&
    v.qty >= 1 &&
    v.qty <= MAX_LINE_QTY
  );
}

/** Reads persisted lines. Corrupt JSON or malformed entries are dropped; never throws. */
export function loadCart(storage: Storage): CartLine[] {
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLine);
  } catch {
    return [];
  }
}

/** Persists lines. Storage errors (quota, private mode) are ignored. */
export function saveCart(storage: Storage, lines: CartLine[]): void {
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Cart still works in memory for this session.
  }
}
