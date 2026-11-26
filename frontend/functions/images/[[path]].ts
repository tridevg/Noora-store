// Proxies /images/* to the Worker. Blob responses keep their immutable Cache-Control.
import { forward, type ProxyEnv } from '../_proxy';

export const onRequest = (context: { request: Request; env: ProxyEnv }): Promise<Response> =>
  forward(context);
