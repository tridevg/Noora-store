/** Canonical public list keys purged after every admin mutation (schema.md Purge rule). */
const CANONICAL_PATHS = ['/api/categories', '/api/products', '/api/services', '/api/settings'];

/** Exact keys (origin + path, no query) for the canonical lists plus each affected product detail. */
export function publicCacheUrls(origin: string, productSlugs: readonly string[]): string[] {
  const urls = CANONICAL_PATHS.map((path) => `${origin}${path}`);
  for (const slug of new Set(productSlugs)) {
    urls.push(`${origin}/api/products/${encodeURIComponent(slug)}`);
  }
  return urls;
}

/**
 * Deletes the canonical public cache keys from caches.default. Resolves even when a delete
 * returns false or fails, so a purge problem never turns a committed write into a 500.
 */
export async function purgePublicCache(
  origin: string,
  productSlugs: readonly string[],
): Promise<void> {
  const cache = caches.default;
  await Promise.all(
    publicCacheUrls(origin, productSlugs).map(async (url) => {
      try {
        await cache.delete(new Request(url));
      } catch (err) {
        console.error('cache purge failed', url, err);
      }
    }),
  );
}
