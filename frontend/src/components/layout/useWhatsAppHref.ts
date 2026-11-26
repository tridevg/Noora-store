import { useEffect, useState } from 'react';
import { buildWhatsAppUrl, type SettingsMap } from '@beauty-store/shared';
import { apiGet } from '../../lib/api';

let cached: Promise<string | null> | null = null;

/** Loads whatsapp_number from GET /api/settings once per page load. Resolves null on failure. */
function loadWhatsAppNumber(): Promise<string | null> {
  cached ??= apiGet<{ settings: SettingsMap }>('/api/settings')
    .then((body) => body.settings.whatsapp_number)
    .catch(() => {
      cached = null;
      return null;
    });
  return cached;
}

/**
 * Returns a wa.me link with no prefilled text, or null while loading or when the
 * number is unset. Callers hide WhatsApp entry points when null.
 */
export function useWhatsAppHref(message = ''): string | null {
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadWhatsAppNumber().then((value) => {
      if (active) setNumber(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!number) return null;
  try {
    return buildWhatsAppUrl(number, message);
  } catch {
    return null;
  }
}
