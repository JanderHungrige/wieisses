// Settings as one JSON value per key. A stored value that no longer validates falls back to
// its default rather than breaking the kiosk.
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '../../shared/schema.ts';
import { transaction, type Db } from './db.ts';

export function getSettings(db: Db): Settings {
  const rows = db.prepare('SELECT key, value FROM setting').all() as { key: string; value: string }[];
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      const candidate = { ...merged, [row.key]: JSON.parse(row.value) };
      if (SettingsSchema.safeParse(candidate).success) merged[row.key] = candidate[row.key];
    } catch {
      // unreadable JSON: keep the default for this key
    }
  }
  return SettingsSchema.parse(merged);
}

export function saveSettings(db: Db, settings: Settings): void {
  const upsert = db.prepare(
    'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  transaction(db, () => {
    for (const [key, value] of Object.entries(settings)) upsert.run(key, JSON.stringify(value));
  });
}
