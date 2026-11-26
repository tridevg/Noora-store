import { describe, expect, it } from 'vitest';
import { MAX_LINE_QTY, type CartLine } from '../../../cart/lines';
import { ApiError } from '../../../lib/api';
import { describeLine, linesOverStock, maxQtyForStock, orderConflictMessage } from '../stockCap';
import { en } from '../../../i18n/en';

const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  productId: 1,
  variantId: 10,
  slug: 'silk-saree',
  name: 'Silk saree',
  size: 'M',
  colour: 'Red',
  unitPricePaise: 129900,
  qty: 1,
  ...overrides,
});

describe('maxQtyForStock (the + control cap)', () => {
  it('caps at the variant stock when stock is below the cart cap', () => {
    expect(maxQtyForStock(3)).toBe(3);
  });

  it('never exceeds the per-line cart cap', () => {
    expect(maxQtyForStock(500)).toBe(MAX_LINE_QTY);
  });

  it('allows zero when the variant is sold out', () => {
    expect(maxQtyForStock(0)).toBe(0);
  });

  it('falls back to the cart cap while stock is unknown', () => {
    expect(maxQtyForStock(undefined)).toBe(MAX_LINE_QTY);
    expect(maxQtyForStock(Number.NaN)).toBe(MAX_LINE_QTY);
  });

  it('treats negative or fractional stock safely', () => {
    expect(maxQtyForStock(-4)).toBe(0);
    expect(maxQtyForStock(2.9)).toBe(2);
  });
});

describe('linesOverStock', () => {
  it('flags lines whose qty is above the variant stock', () => {
    const stock = new Map([
      [10, 1],
      [20, 5],
    ]);
    const lines = [line({ variantId: 10, qty: 2 }), line({ variantId: 20, qty: 5 })];
    expect(linesOverStock(lines, stock).map((l) => l.variantId)).toEqual([10]);
  });

  it('flags a variant that is now sold out (stock 0)', () => {
    const stock = new Map([[10, 0]]);
    expect(linesOverStock([line({ qty: 1 })], stock)).toHaveLength(1);
  });

  it('does not judge lines whose stock is unknown', () => {
    expect(linesOverStock([line({ qty: 9 })], new Map())).toEqual([]);
  });
});

describe('orderConflictMessage (409 mapping)', () => {
  const conflict = new ApiError(409, 'conflict', 'Not enough stock for Silk saree');

  it('lists the out-of-stock items by name', () => {
    const names = [describeLine(line()), describeLine(line({ name: 'Kurta', size: 'S' }))];
    expect(orderConflictMessage(conflict, names)).toBe(
      `These items do not have enough stock: ${names.join(', ')}. Lower the quantity or remove them, then try again. Your cart has been kept.`,
    );
  });

  it('falls back to the generic conflict text when no line could be identified', () => {
    expect(orderConflictMessage(conflict, [])).toBe(en.storefront.cart.conflictGeneric);
  });

  it('returns null for any status other than 409', () => {
    const rateLimited = new ApiError(429, 'rate_limited', 'Too many orders');
    expect(orderConflictMessage(rateLimited, ['Silk saree (M / Red)'])).toBeNull();
    expect(orderConflictMessage(new Error('boom'), [])).toBeNull();
  });

  it('describes a line with its size and colour', () => {
    expect(describeLine(line())).toBe('Silk saree (M / Red)');
  });
});
