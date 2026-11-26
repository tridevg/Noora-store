import { describe, expect, it } from 'vitest';
import type { VariantDto } from '@beauty-store/shared';
import { lineForVariant, quickAddVariant } from '../bagActions';

const product = { id: 7, slug: 'silk-kurta', name: 'Silk kurta', price_paise: 149900 };

function variant(overrides: Partial<VariantDto> = {}): VariantDto {
  return {
    id: 31,
    product_id: 7,
    size: 'M',
    colour: 'Sage',
    sku: 'SK-M-SAGE',
    stock: 4,
    ...overrides,
  };
}

describe('lineForVariant', () => {
  it('builds a one-unit cart line with integer paise from the product and variant', () => {
    const line = lineForVariant(product, variant());
    expect(line).toEqual({
      productId: 7,
      variantId: 31,
      slug: 'silk-kurta',
      name: 'Silk kurta',
      size: 'M',
      colour: 'Sage',
      unitPricePaise: 149900,
      qty: 1,
    });
    expect(Number.isSafeInteger(line.unitPricePaise)).toBe(true);
  });
});

describe('quickAddVariant', () => {
  it('returns the only variant when it is in stock', () => {
    expect(quickAddVariant([variant({ stock: 2 })])?.id).toBe(31);
  });

  it('returns nothing when the single variant is sold out', () => {
    expect(quickAddVariant([variant({ stock: 0 })])).toBeUndefined();
  });

  it('returns nothing when there are several variants, so the customer picks one', () => {
    expect(quickAddVariant([variant(), variant({ id: 32, size: 'L' })])).toBeUndefined();
  });

  it('returns nothing when the product has no variants', () => {
    expect(quickAddVariant([])).toBeUndefined();
  });
});
