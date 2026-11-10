// The demo set's marker, counts and removal (doc 04, "Demo data"). The set is everything that
// hangs off one device, whose id the setting row `demo.deviceId` keeps; removal goes by that id.
import { transaction, type Db } from './db.ts';

const KEY = 'demo.deviceId';
const CODES = 'SELECT id FROM child_code WHERE device_id = ?1';

export type DemoCounts = { codes: number; submissions: number; answers: number; from: string | null; to: string | null };

export function demoDeviceId(db: Db): number | null {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(KEY) as { value: string } | undefined;
  return row ? Number(JSON.parse(row.value)) : null;
}

export function markDemoDevice(db: Db, deviceId: number): void {
  db.prepare('INSERT INTO setting (key, value) VALUES (?, ?)').run(KEY, JSON.stringify(deviceId));
}

export function demoCounts(db: Db, deviceId: number): DemoCounts {
  const row = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM child_code WHERE device_id = ?1) AS codes,
              (SELECT COUNT(*) FROM submission WHERE code_id IN (${CODES})) AS submissions,
              (SELECT COUNT(*) FROM answer WHERE submission_id IN (SELECT id FROM submission WHERE code_id IN (${CODES}))) AS answers,
              (SELECT MIN(day) FROM submission WHERE code_id IN (${CODES})) AS from_day,
              (SELECT MAX(day) FROM submission WHERE code_id IN (${CODES})) AS to_day`,
    )
    .get(deviceId) as Record<string, unknown>;
  return {
    codes: Number(row.codes),
    submissions: Number(row.submissions),
    answers: Number(row.answers),
    from: (row.from_day as string | null) ?? null,
    to: (row.to_day as string | null) ?? null,
  };
}

/** Deletes the demo answers, submissions, codes, the device and the marker — nothing else. */
export function deleteDemo(db: Db, deviceId: number): void {
  transaction(db, () => {
    db.prepare(`DELETE FROM answer WHERE submission_id IN (SELECT id FROM submission WHERE code_id IN (${CODES}))`).run(deviceId);
    db.prepare(`DELETE FROM submission WHERE code_id IN (${CODES})`).run(deviceId);
    db.prepare('DELETE FROM child_code WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM device WHERE id = ?').run(deviceId);
    db.prepare('DELETE FROM setting WHERE key = ?').run(KEY);
  });
}
