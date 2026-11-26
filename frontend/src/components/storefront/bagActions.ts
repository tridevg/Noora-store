// Helpers shared by the product card, the product page and the bag drawer.
import type { ProductSummaryDto, VariantDto } from '@beauty-store/shared';
import type { CartLine } from '../../cart';
import { maxQtyForStock } from './stockCap';

/** Cart line for one variant of a product. Quantity starts at 1; the cart merges repeats. */
export function lineForVariant(
  product: Pick<ProductSummaryDto, 'id' | 'slug' | 'name' | 'price_paise'>,
  variant: VariantDto,
): CartLine {
  return {
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    name: product.name,
    size: variant.size,
    colour: variant.colour,
    unitPricePaise: product.price_paise,
    qty: 1,
  };
}

/**
 * What Add to Bag does on a product card. A product with exactly one variant that is in stock
 * goes straight to the bag. Anything else (several sizes or colours, or nothing in stock) opens
 * the product page so the customer can choose.
 */
export function quickAddVariant(variants: readonly VariantDto[]): VariantDto | undefined {
  if (variants.length !== 1) return undefined;
  const only = variants[0];
  return only && maxQtyForStock(only.stock) > 0 ? only : undefined;
}
