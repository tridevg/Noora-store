import { Hono } from 'hono';
import { SettingsUpdateSchema, type SettingKey } from '@beauty-store/shared';
import { purgePublicCache } from '../cache/purge';
import { clientOrigin } from './origin';
import { parseJson } from './data';
import type { AdminEnv } from './middleware';
import { loadSettings } from './queries';

export const settingsRoutes = new Hono<AdminEnv>();

/** PUT /api/admin/settings: partial map of the five fixed keys. Unknown keys are rejected by the schema. */
settingsRoutes.put('/settings', async (c) => {
  const parsed = await parseJson(c, (v) => SettingsUpdateSchema.safeParse(v));
  if ('response' in parsed) return parsed.response;
  const entries = Object.entries(parsed.data) as [SettingKey, string][];
  await c.env.DB.batch(
    entries.map(([key, value]) =>
      c.env.DB.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ).bind(key, value),
    ),
  );
  const settings = await loadSettings(c.env.DB);
  await purgePublicCache(clientOrigin(c.req.raw), []);
  return c.json({ settings });
});
