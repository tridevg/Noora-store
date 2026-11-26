// Typed fetch wrapper for /api/*. Every request sends cookies (credentials: 'include').
// Admin mutations send X-CSRF-Token copied from the bs_csrf cookie (architecture.md section 5).
import type { ErrorCode, ErrorEnvelope } from '@beauty-store/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'network';
  readonly fields?: Record<string, string>;
  readonly retryAfter?: number;

  constructor(
    status: number,
    code: ErrorCode | 'network',
    message: string,
    fields?: Record<string, string>,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

export interface ApiOptions {
  /** Send X-CSRF-Token. Defaults to true for any path under /api/admin/. */
  csrf?: boolean;
  signal?: AbortSignal;
}

const CSRF_COOKIE = 'bs_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

/** Reads a cookie value by name. Returns undefined when absent or not in a browser. */
export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

async function parseError(response: Response): Promise<ApiError> {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  const body: unknown = await response.json().catch(() => null);
  if (isErrorEnvelope(body)) {
    const { code, message, fields } = body.error;
    return new ApiError(response.status, code, message, fields, retryAfter);
  }
  return new ApiError(
    response.status,
    'internal',
    `HTTP ${response.status}`,
    undefined,
    retryAfter,
  );
}

/**
 * Core request. Resolves with the parsed JSON body, or undefined for 204.
 * Throws ApiError for non-2xx responses and for network failures (code 'network').
 */
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  opts: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const useCsrf = opts.csrf ?? (method !== 'GET' && path.startsWith('/api/admin/'));
  if (useCsrf) {
    const token = readCookie(CSRF_COOKIE);
    if (token) headers[CSRF_HEADER] = token;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: opts.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network', 'Network request failed');
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>('GET', path, undefined, { signal });
}

export function apiPost<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return apiRequest<T>('POST', path, body, opts);
}

export function apiPut<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return apiRequest<T>('PUT', path, body, opts);
}

export function apiPatch<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return apiRequest<T>('PATCH', path, body, opts);
}

export function apiDelete<T = void>(path: string, opts?: ApiOptions): Promise<T> {
  return apiRequest<T>('DELETE', path, undefined, opts);
}

export { CSRF_COOKIE, CSRF_HEADER };
