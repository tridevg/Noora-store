import { t } from '../../i18n';
import { ApiError } from '../../lib/api';

/** Maps any thrown value from apiRequest to a user-facing English string from en.ts. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'network') return t('errors.network');
    if (error.code === 'rate_limited') return t('errors.rateLimited');
    if (error.code === 'not_found') return t('errors.notFound');
    if (error.code === 'validation_failed') return t('errors.validation');
    if (error.code === 'conflict') return t('errors.conflict');
    if (error.code === 'unauthorized') return t('errors.unauthorized');
  }
  return t('errors.generic');
}

/** Replaces a {name} placeholder in an en.ts string. Keys stay in en.ts; only values are filled in. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template,
  );
}
