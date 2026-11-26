import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProductDetailDto } from '@beauty-store/shared';
import type { CartLine } from '../../cart';
import { ApiError, apiGet } from '../../lib/api';
import { type StockMap } from './stockCap';

const NO_STOCK: StockMap = new Map();

/** Fetches each cart product once and maps every line's variant to its current stock. */
export async function fetchCartStock(
  lines: readonly CartLine[],
  signal?: AbortSignal,
): Promise<Map<number, number>> {
  const slugs = [...new Set(lines.map((line) => line.slug))];
  const bySlug = new Map<string, ProductDetailDto['variants'] | null>();
  await Promise.all(
    slugs.map(async (slug) => {
      try {
        const body = await apiGet<{ product: ProductDetailDto }>(
          `/api/products/${encodeURIComponent(slug)}`,
          signal,
        );
        bySlug.set(slug, body.product.variants);
      } catch (error) {
        if (signal?.aborted) throw error;
        // A removed product has no stock. Any other failure leaves stock unknown.
        bySlug.set(slug, error instanceof ApiError && error.status === 404 ? [] : null);
      }
    }),
  );
  const stock = new Map<number, number>();
  for (const line of lines) {
    const variants = bySlug.get(line.slug);
    if (!variants) continue;
    stock.set(line.variantId, variants.find((v) => v.id === line.variantId)?.stock ?? 0);
  }
  return stock;
}

/** Identity of the cart's products and variants. Quantity changes do not change it. */
function signature(lines: readonly CartLine[]): string {
  return lines
    .map((line) => `${line.slug}#${line.variantId}`)
    .sort()
    .join('|');
}

/**
 * Current stock for the cart. Re-fetches only when the set of products or variants changes.
 * refresh() re-checks on demand (used after a 409) and resolves with the new map.
 */
export function useCartStock(lines: readonly CartLine[]): {
  stock: StockMap;
  refresh: (current: readonly CartLine[]) => Promise<StockMap>;
} {
  const sig = signature(lines);
  // Keyed by sig: the snapshot is taken when the identity changes, not on every quantity change.
  const snapshot = useMemo(() => lines, [sig]);
  const [state, setState] = useState<{ sig: string; stock: StockMap } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCartStock(snapshot, controller.signal)
      .then((stock) => {
        if (!controller.signal.aborted) setState({ sig, stock });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [snapshot, sig]);

  const refresh = useCallback(async (current: readonly CartLine[]) => {
    const stock = await fetchCartStock(current);
    setState({ sig: signature(current), stock });
    return stock;
  }, []);

  return { stock: state?.sig === sig ? state.stock : NO_STOCK, refresh };
}
