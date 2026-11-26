/** Origin of the admin request; used to build canonical cache keys for purging. */
export function clientOrigin(request: Request): string {
  return new URL(request.url).origin;
}
