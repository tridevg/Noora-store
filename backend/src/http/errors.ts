import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode, ErrorEnvelope } from '@beauty-store/shared';
import { CACHE_NO_STORE } from './cache';

/** Builds the standard error envelope. Every error response is no-store. */
export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  fields?: Record<string, string>,
): Response {
  const body: ErrorEnvelope = fields
    ? { error: { code, message, fields } }
    : { error: { code, message } };
  c.header('Cache-Control', CACHE_NO_STORE);
  return c.json(body, status);
}

/** Flattens Zod issues into a field -> message map (first issue per field wins). */
export function issueFields(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'body';
    fields[key] ??= issue.message;
  }
  return fields;
}
