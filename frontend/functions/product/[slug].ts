// Serves the SPA shell for /product/:slug with a preload for the product's main image.
// The product JSON comes from the Worker (same origin as /api/*). The main image is the first gallery
// image, using the same srcset and sizes as ProductGallery, so the preload matches the <img> candidate.
// Any failure (upstream error, 404, odd data) falls back to the plain shell with its original status.
import { DEFAULT_UPSTREAM, type ProxyEnv } from '../_proxy';

interface ProductImageDto {
  full_url?: unknown;
  thumb_url?: unknown;
}

interface ProductFunctionContext {
  request: Request;
  env: ProxyEnv;
  params: { slug?: string | string[] };
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
}

const IMAGE_SIZES = '(min-width: 768px) 50vw, 100vw';
const UPSTREAM_TIMEOUT_MS = 2000;
// Only same-origin /images/ paths produced by the Worker are echoed into headers and HTML.
const SAFE_IMAGE_PATH = /^\/images\/[A-Za-z0-9/_.-]+$/;

export async function onRequest(context: ProductFunctionContext): Promise<Response> {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return context.next();
  }

  const shell = await context.next(
    new Request(new URL('/', context.request.url), context.request),
  );
  if (!shell.ok || context.request.method !== 'GET') return shell;

  const images = await loadImages(context);
  const first = images[0];
  if (!first) return shell;

  const full = first.full_url;
  const thumb = first.thumb_url;
  if (!isSafePath(full) || !isSafePath(thumb)) return shell;

  const srcset = `${thumb} 400w, ${full} 1600w`;
  const link = `<${full}>; rel=preload; as=image; imagesrcset="${srcset}"; imagesizes="${IMAGE_SIZES}"; fetchpriority=high`;
  const tag = `<link rel="preload" as="image" href="${full}" imagesrcset="${srcset}" imagesizes="${IMAGE_SIZES}" fetchpriority="high">`;

  const rewritten = new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(tag, { html: true });
      },
    })
    .transform(shell);

  const headers = new Headers(rewritten.headers);
  headers.delete('content-length');
  headers.set('Link', link);
  // The preload depends on the product, so it is not cached beyond a revalidation.
  headers.set('Cache-Control', 'no-cache');

  return new Response(rewritten.body, {
    status: shell.status,
    statusText: shell.statusText,
    headers,
  });
}

interface LoadedImage {
  full_url: string;
  thumb_url: string;
}

async function loadImages(context: ProductFunctionContext): Promise<LoadedImage[]> {
  const raw = Array.isArray(context.params.slug) ? context.params.slug[0] : context.params.slug;
  if (!raw) return [];
  const base = (context.env.UPSTREAM_ORIGIN || DEFAULT_UPSTREAM).replace(/\/+$/, '');
  try {
    const upstream = await fetch(`${base}/api/products/${encodeURIComponent(raw)}`, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return [];
    const body = (await upstream.json()) as { product?: { images?: ProductImageDto[] } };
    const list = body.product?.images ?? [];
    return list.filter(
      (image): image is LoadedImage =>
        typeof image.full_url === 'string' && typeof image.thumb_url === 'string',
    );
  } catch {
    return [];
  }
}

function isSafePath(value: string): boolean {
  return SAFE_IMAGE_PATH.test(value);
}
