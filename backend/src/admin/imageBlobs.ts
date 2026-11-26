/** Output limits (approved, Phase 7): full <= 500,000 bytes, thumb <= 300,000 bytes. */
export const IMAGE_LIMIT_BYTES = {
  full: 500_000,
  thumb: 300_000,
} as const;

/** Room for multipart framing and the text fields around the two image parts. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export type ImageContentType = 'image/webp' | 'image/jpeg';

const EXTENSION_FOR_TYPE: Record<ImageContentType, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};

export function isImageContentType(value: string): value is ImageContentType {
  return Object.prototype.hasOwnProperty.call(EXTENSION_FOR_TYPE, value);
}

export interface ImageBlob {
  contentType: ImageContentType;
  data: Uint8Array;
}

export interface ImageLinkInput {
  productId: number;
  full: ImageBlob;
  thumb: ImageBlob;
  altText: string;
  sortOrder: number;
}

/**
 * Stores both blobs and the product_images link in one D1 batch. D1 runs a batch as one
 * transaction, so either all three rows exist afterwards or none do. Keys are generated here,
 * never taken from the client. Throws on any failure; the caller maps it to an error response.
 */
export async function linkImageWithBlobs(
  db: D1Database,
  input: ImageLinkInput,
): Promise<{ id: number; fullKey: string; thumbKey: string }> {
  const uuid = crypto.randomUUID();
  const fullKey = `products/${input.productId}/${uuid}-full.${EXTENSION_FOR_TYPE[input.full.contentType]}`;
  const thumbKey = `products/${input.productId}/${uuid}-thumb.${EXTENSION_FOR_TYPE[input.thumb.contentType]}`;
  const [linked] = await db.batch([
    db
      .prepare(
        `INSERT INTO product_images (product_id, r2_key, thumb_r2_key, alt_text, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(input.productId, fullKey, thumbKey, input.altText, input.sortOrder),
    db
      .prepare('INSERT INTO product_image_blobs (key, content_type, data) VALUES (?, ?, ?)')
      .bind(fullKey, input.full.contentType, input.full.data),
    db
      .prepare('INSERT INTO product_image_blobs (key, content_type, data) VALUES (?, ?, ?)')
      .bind(thumbKey, input.thumb.contentType, input.thumb.data),
  ]);
  return { id: linked!.meta.last_row_id, fullKey, thumbKey };
}

/**
 * Removes one image link and its two blobs in one batch. A blob is deleted only if no
 * product_images row references its key any more (the rule that a referenced key is never deleted).
 * Returns false when the image does not belong to the product.
 */
export async function unlinkImage(
  db: D1Database,
  productId: number,
  imageId: number,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT r2_key, thumb_r2_key FROM product_images WHERE id = ? AND product_id = ?')
    .bind(imageId, productId)
    .first<{ r2_key: string; thumb_r2_key: string }>();
  if (row === null) return false;
  await db.batch([
    db
      .prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?')
      .bind(imageId, productId),
    db
      .prepare(
        `DELETE FROM product_image_blobs WHERE key IN (?, ?)
         AND NOT EXISTS (SELECT 1 FROM product_images
           WHERE r2_key = product_image_blobs.key OR thumb_r2_key = product_image_blobs.key)`,
      )
      .bind(row.r2_key, row.thumb_r2_key),
  ]);
  return true;
}

/**
 * Statements that remove a product's blobs and then the product. Run them in one batch.
 * Blobs go first, while the product_images rows still exist. A blob used by another product
 * is kept. The FK cascade then removes the image rows and variants.
 */
export function deleteProductStatements(db: D1Database, productId: number): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `DELETE FROM product_image_blobs WHERE key IN (
           SELECT r2_key FROM product_images WHERE product_id = ?
           UNION SELECT thumb_r2_key FROM product_images WHERE product_id = ?)
         AND NOT EXISTS (SELECT 1 FROM product_images p
           WHERE p.product_id <> ? AND (p.r2_key = product_image_blobs.key OR p.thumb_r2_key = product_image_blobs.key))`,
      )
      .bind(productId, productId, productId),
    db.prepare('DELETE FROM products WHERE id = ?').bind(productId),
  ];
}

export interface StoredBlob {
  content_type: string;
  data: Uint8Array;
}

/**
 * D1 hands BLOB columns back as a plain number array (not ArrayBuffer), and a Response built
 * from that array would send the text "255,216,...". Normalise to bytes here.
 */
function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new Error('product_image_blobs.data is not binary');
}

/** Reads one stored image by key. Returns null for an unknown key. */
export async function readImageBlob(db: D1Database, key: string): Promise<StoredBlob | null> {
  const row = await db
    .prepare('SELECT content_type, data FROM product_image_blobs WHERE key = ?')
    .bind(key)
    .first<{ content_type: string; data: unknown }>();
  if (row === null) return null;
  return { content_type: row.content_type, data: toBytes(row.data) };
}

/**
 * Reads a request body into memory, stopping as soon as it exceeds the limit.
 * Returns 'too_large' without buffering the rest of an oversize body.
 */
export async function readBounded(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Uint8Array | 'too_large'> {
  if (stream === null) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return 'too_large';
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
