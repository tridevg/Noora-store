// Proxies /api/* to the Worker with the same path, method, headers, body and response.
import { forward, type ProxyEnv } from '../_proxy';

export const onRequest = (context: { request: Request; env: ProxyEnv }): Promise<Response> =>
  forward(context);
