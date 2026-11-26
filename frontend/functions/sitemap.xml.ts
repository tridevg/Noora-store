// Proxies /sitemap.xml to the Worker; its absolute URLs use SITE_URL (the Pages origin).
import { forward, type ProxyEnv } from './_proxy';

export const onRequest = (context: { request: Request; env: ProxyEnv }): Promise<Response> =>
  forward(context);
