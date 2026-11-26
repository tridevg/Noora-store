import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { apiError } from '../http/errors';
import { CACHE_IMMUTABLE } from '../http/cache';
import { readImageBlob } from '../admin/imageBlobs';

export const imageRoutes = new Hono<AppEnv>();

/** GET /images/*: serves one image blob from D1 with its stored Content-Type. */
imageRoutes.get('/images/*', async (c) => {
  const raw = c.req.path.slice('/images/'.length);
  let key: string;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return apiError(c, 400, 'validation_failed', 'Invalid image key');
  }
  if (key.includes('..')) return apiError(c, 400, 'validation_failed', 'Invalid image key');
  if (key.length === 0) return apiError(c, 404, 'not_found', 'Image not found');

  const blob = await readImageBlob(c.env.DB, key);
  if (blob === null) return apiError(c, 404, 'not_found', 'Image not found');

  const headers = new Headers();
  headers.set('Content-Type', blob.content_type);
  headers.set('Cache-Control', CACHE_IMMUTABLE);
  return new Response(blob.data, { status: 200, headers });
});
