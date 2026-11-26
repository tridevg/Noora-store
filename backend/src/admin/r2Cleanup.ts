import type { Env } from '../env';

/**
 * Deletes R2 objects that no product_images row references. Used when a link insert fails, so
 * the uploaded objects do not stay orphaned. Keys that a live row already uses are skipped: a
 * UNIQUE collision on r2_key means that object belongs to the existing image. Never throws, so
 * the caller can still return the original error.
 */
export async function deleteOrphanedObjects(
  env: Pick<Env, 'DB' | 'IMAGES'>,
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0) return;
  try {
    const marks = keys.map(() => '?').join(', ');
    const referenced = await env.DB.prepare(
      `SELECT r2_key AS k FROM product_images WHERE r2_key IN (${marks})
       UNION SELECT thumb_r2_key AS k FROM product_images WHERE thumb_r2_key IN (${marks})`,
    )
      .bind(...keys, ...keys)
      .all<{ k: string }>();
    const live = new Set(referenced.results.map((r) => r.k));
    const orphans = keys.filter((k) => !live.has(k));
    if (orphans.length > 0) await env.IMAGES.delete(orphans);
  } catch (err) {
    console.error('orphaned R2 cleanup failed', keys, err);
  }
}
