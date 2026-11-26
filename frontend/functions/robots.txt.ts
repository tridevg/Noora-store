// Proxies /robots.txt to the Worker.
import { forward, type ProxyEnv } from './_proxy';

export const onRequest = (context: { request: Request; env: ProxyEnv }): Promise<Response> =>
  forward(context);
