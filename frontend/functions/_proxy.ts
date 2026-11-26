// Shared forwarder for the Pages Functions routes (/api/*, /images/*, /sitemap.xml, /robots.txt).
// The browser only talks to the Pages origin, so SameSite=Strict cookies and the no-CORS rule hold.
// The upstream response is returned unchanged: status, Set-Cookie, Cache-Control and bodies.
// Set-Cookie is issued for the Pages host because the Pages host is the one that answers the browser.

export const DEFAULT_UPSTREAM = 'https://noora-api.tridev-g811.workers.dev';

export interface ProxyEnv {
  /** Optional override for the Worker origin, for example a preview Worker. No trailing slash. */
  UPSTREAM_ORIGIN?: string;
}

export interface ProxyContext {
  request: Request;
  env: ProxyEnv;
}

export async function forward({ request, env }: ProxyContext): Promise<Response> {
  const incoming = new URL(request.url);
  const base = (env.UPSTREAM_ORIGIN || DEFAULT_UPSTREAM).replace(/\/+$/, '');
  const target = `${base}${incoming.pathname}${incoming.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
