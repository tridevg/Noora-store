import { t, type MessageKey } from '../../i18n';
import { ApiError } from '../../lib/api';

/** Maps any thrown value to a user-facing English string from i18n. */
export function describeError(error: unknown, fallback: MessageKey = 'admin.common.saveFailed') {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'unauthorized':
        return t('errors.unauthorized');
      case 'csrf_failed':
        return t('errors.csrfFailed');
      case 'rate_limited':
        return t('errors.rateLimited');
      case 'validation_failed':
        return t('errors.validation');
      case 'conflict':
        return t('errors.conflict');
      case 'not_found':
        return t('admin.common.notFound');
      case 'network':
        return t('errors.network');
      default:
        break;
    }
  }
  return t(fallback);
}

/** Server-side field messages (400 validation_failed), or an empty object. */
export function serverFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiError && error.fields) return { ...error.fields };
  return {};
}

/** Zod issues keyed by the first path segment, so each form field gets one message. */
export function zodFieldErrors(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}
