import { Hono } from 'hono';
import { UploadKeySchema } from '@beauty-store/shared';
import { apiError } from '../http/errors';
import type { AdminEnv } from './middleware';

/** Output limits (approved R8): full <= 3 MB, thumb <= 300 KB. */
export const UPLOAD_LIMIT_BYTES = {
  full: 3 * 1024 * 1024,
  thumb: 300 * 1024,
} as const;

const EXTENSION_FOR_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};

/**
 * Reads the stream while counting bytes. Returns 'too_large' as soon as the limit is exceeded,
 * so an oversize body is never fully buffered.
 */
async function readBounded(
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

export const uploadsRoutes = new Hono<AdminEnv>();

/**
 * PUT /api/admin/uploads?key=<r2Key>: raw image body. Stores bytes as received with the real
 * Content-Type. Never decodes or re-encodes in the Worker. No cache purge (no public list changes).
 */
uploadsRoutes.put('/uploads', async (c) => {
  const keyParsed = UploadKeySchema.safeParse(c.req.query('key') ?? '');
  if (!keyParsed.success) {
    return apiError(c, 400, 'validation_failed', 'Invalid upload key', {
      key: 'invalid upload key',
    });
  }
  const key = keyParsed.data;
  const variant = key.endsWith('-full.webp') || key.endsWith('-full.jpg') ? 'full' : 'thumb';
  const extension = key.slice(key.lastIndexOf('.') + 1);

  const contentType = (c.req.header('Content-Type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (EXTENSION_FOR_TYPE[contentType] === undefined) {
    return apiError(c, 400, 'validation_failed', 'Content-Type must be image/webp or image/jpeg');
  }
  if (EXTENSION_FOR_TYPE[contentType] !== extension) {
    return apiError(c, 400, 'validation_failed', 'Content-Type does not match the key extension');
  }

  const limit = UPLOAD_LIMIT_BYTES[variant];
  const declared = c.req.header('Content-Length');
  if (declared !== undefined && Number(declared) > limit) {
    return apiError(c, 413, 'validation_failed', `Image exceeds the ${variant} size limit`);
  }

  const body = await readBounded(c.req.raw.body, limit);
  if (body === 'too_large') {
    return apiError(c, 413, 'validation_failed', `Image exceeds the ${variant} size limit`);
  }
  if (body.byteLength === 0) {
    return apiError(c, 400, 'validation_failed', 'Empty upload body');
  }

  // Keys are UUID-based and served with an immutable cache header, so never overwrite an object.
  if ((await c.env.IMAGES.head(key)) !== null) {
    return apiError(c, 409, 'conflict', 'An object with this key already exists');
  }

  await c.env.IMAGES.put(key, body, { httpMetadata: { contentType } });
  return c.json({ key, size: body.byteLength }, 201);
});
