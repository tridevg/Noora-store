import type { ServiceDto, SettingKey, SettingsMap } from '@beauty-store/shared';

export type Db = D1Database;

export const SETTING_KEYS: SettingKey[] = [
  'business_name',
  'whatsapp_number',
  'address',
  'opening_hours',
  'banner_text',
];

export async function categoryExists(db: Db, id: number): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(id).first();
  return row !== null;
}

export interface ServiceRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  price_paise: number;
  duration_minutes: number;
  is_active: number;
  category_id: number;
  category_name: string;
  category_slug: string;
}

export const SERVICE_SELECT = `SELECT s.id, s.name, s.slug, s.description, s.price_paise, s.duration_minutes,
  s.is_active, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
  FROM services s JOIN categories c ON c.id = s.category_id`;

export function toServiceDto(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price_paise: row.price_paise,
    duration_minutes: row.duration_minutes,
    is_active: row.is_active === 1,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
  };
}

export async function loadSettings(db: Db): Promise<SettingsMap> {
  const result = await db
    .prepare('SELECT key, value FROM settings')
    .all<{ key: SettingKey; value: string }>();
  const settings = Object.fromEntries(SETTING_KEYS.map((k) => [k, ''])) as SettingsMap;
  for (const row of result.results) settings[row.key] = row.value;
  return settings;
}
