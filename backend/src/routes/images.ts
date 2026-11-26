import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { apiError } from '../http/errors';
import { CACHE_IMMUTABLE } from '../http/cache';

export const imageRoutes = new Hono<AppEnv>();

/** GET /images/* streams the R2 object without buffering. */
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

  const object = await c.env.IMAGES.get(key);
  if (object === null) return apiError(c, 404, 'not_found', 'Image not found');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
  headers.set('Cache-Control', CACHE_IMMUTABLE);
  headers.set('ETag', object.httpEtag);
  return new Response(object.body, { status: 200, headers });
});
