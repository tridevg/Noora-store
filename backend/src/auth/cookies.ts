/** Session lifetime: 8 hours (schema.md Cookies). */
export const SESSION_MAX_AGE_SEC = 28800;
export const SESSION_COOKIE = 'bs_admin';
export const CSRF_COOKIE = 'bs_csrf';

/** Secure only when the request URL is https (architecture.md section 5). */
function secureAttr(request: Request): string {
  return request.url.startsWith('https://') ? '; Secure' : '';
}

/** Set-Cookie values for a fresh login: HttpOnly session plus readable CSRF token. */
export function buildAuthCookies(
  request: Request,
  sessionToken: string,
  csrfToken: string,
): string[] {
  const secure = secureAttr(request);
  return [
    `${SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`,
    `${CSRF_COOKIE}=${csrfToken}; Path=/; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`,
  ];
}

/** Set-Cookie values that expire both auth cookies. */
export function clearAuthCookies(request: Request): string[] {
  const secure = secureAttr(request);
  return [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0${secure}`,
  ];
}

/** Reads one cookie value from the Cookie header. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0 && trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return undefined;
}
