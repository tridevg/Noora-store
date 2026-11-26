import { buildWhatsAppUrl, type SettingsMap } from '@beauty-store/shared';
import { useApiResource } from './useApiResource';

/** Settings map from GET /api/settings, or undefined while loading or on failure. */
export function useSettings(): SettingsMap | undefined {
  const { data } = useApiResource<{ settings: SettingsMap }>('/api/settings');
  return data?.settings;
}

/** wa.me link with a prefilled message, or null when the number is unset or invalid. */
export function whatsAppLink(settings: SettingsMap | undefined, message: string): string | null {
  const number = settings?.whatsapp_number ?? '';
  if (!number) return null;
  try {
    return buildWhatsAppUrl(number, message);
  } catch {
    return null;
  }
}
