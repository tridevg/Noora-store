// Cart stock rules: how far the + control may go, which lines are over stock, and the 409 message.
import { MAX_LINE_QTY, type CartLine } from '../../cart';
import { t } from '../../i18n';
import { ApiError } from '../../lib/api';
import { fill } from './errorMessage';

/** Available stock per variant id. A variant missing from a fetched product maps to 0. */
export type StockMap = ReadonlyMap<number, number>;

/**
 * Highest quantity the + control may reach for a line. Unknown stock (still loading, or the
 * product request failed) falls back to the cart-wide cap; the server still checks on order.
 */
export function maxQtyForStock(stock: number | undefined): number {
  if (stock === undefined || !Number.isFinite(stock)) return MAX_LINE_QTY;
  return Math.max(0, Math.min(MAX_LINE_QTY, Math.trunc(stock)));
}

/** Lines whose quantity is above the stock known for their variant. Unknown variants are not flagged. */
export function linesOverStock(lines: readonly CartLine[], stock: StockMap): CartLine[] {
  return lines.filter((line) => {
    const available = stock.get(line.variantId);
    return available !== undefined && line.qty > available;
  });
}

/** "Silk saree (M / Red)": the name a customer recognises in the cart. */
export function describeLine(line: CartLine): string {
  return `${line.name} (${line.size} / ${line.colour})`;
}

/**
 * Message for a failed POST /api/orders. Returns null for anything other than 409.
 * The server names only the first failing item, so the list comes from the stock check.
 */
export function orderConflictMessage(error: unknown, outOfStock: readonly string[]): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  if (outOfStock.length === 0) return t('storefront.cart.conflictGeneric');
  return fill(t('storefront.cart.conflictListed'), { items: outOfStock.join(', ') });
}
