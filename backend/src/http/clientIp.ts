/** Client IP from CF-Connecting-IP; falls back to 127.0.0.1 for local requests. */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? '127.0.0.1';
}
