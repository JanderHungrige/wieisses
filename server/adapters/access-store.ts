// Who may do what: registered tablets, children's picture codes and admin sessions.
// Tokens are stored only as sha256 hashes (doc 01, "Security").
import type { CodePicks } from '../../shared/catalog.ts';
import type { ChildCode, Device } from '../../shared/schema.ts';
import { hashToken, newToken } from '../domain/secrets.ts';
import { bool, isUniqueViolation, type Db } from './db.ts';

type Row = Record<string, unknown>;

// ── Devices ────────────────────────────────────────────────────────────────

function deviceFromRow(row: Row): Device {
  return {
    id: Number(row.id),
    label: String(row.label),
    createdAt: String(row.created_at),
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    revoked: bool(row.revoked),
  };
}

export function registerDevice(db: Db, label: string, now: Date): { device: Device; token: string } {
  const token = newToken();
  const { lastInsertRowid } = db
    .prepare('INSERT INTO device (label, token_hash, created_at) VALUES (?, ?, ?)')
    .run(label, hashToken(token), now.toISOString());
  const row = db.prepare('SELECT * FROM device WHERE id = ?').get(lastInsertRowid) as Row;
  return { device: deviceFromRow(row), token };
}

/** The active device a token belongs to, marked as seen; undefined when unknown or revoked. */
export function deviceByToken(db: Db, token: string, now: Date): Device | undefined {
  const row = db.prepare('SELECT * FROM device WHERE token_hash = ? AND revoked = 0').get(hashToken(token)) as Row | undefined;
  if (!row) return undefined;
  db.prepare('UPDATE device SET last_seen_at = ? WHERE id = ?').run(now.toISOString(), row.id as number);
  return deviceFromRow({ ...row, last_seen_at: now.toISOString() });
}

export function listDevices(db: Db): Device[] {
  return (db.prepare('SELECT * FROM device ORDER BY id').all() as Row[]).map(deviceFromRow);
}

export function updateDevice(db: Db, id: number, patch: { label?: string; revoked?: boolean }): Device | undefined {
  if (patch.label !== undefined) db.prepare('UPDATE device SET label = ? WHERE id = ?').run(patch.label, id);
  if (patch.revoked !== undefined) db.prepare('UPDATE device SET revoked = ? WHERE id = ?').run(patch.revoked ? 1 : 0, id);
  const row = db.prepare('SELECT * FROM device WHERE id = ?').get(id) as Row | undefined;
  return row ? deviceFromRow(row) : undefined;
}

// ── Children's picture codes ───────────────────────────────────────────────

export function findCode(db: Db, picks: CodePicks): { id: number; active: boolean } | undefined {
  const row = db
    .prepare('SELECT id, active FROM child_code WHERE animal = ? AND color = ? AND fruit = ?')
    .get(picks.animal, picks.color, picks.fruit) as Row | undefined;
  return row ? { id: Number(row.id), active: bool(row.active) } : undefined;
}

export function codeIsActive(db: Db, id: number): boolean {
  const row = db.prepare('SELECT active FROM child_code WHERE id = ?').get(id) as Row | undefined;
  return row !== undefined && bool(row.active);
}

export function createCode(
  db: Db,
  code: CodePicks & { grade: number; deviceId: number; createdAt: string },
): number | 'taken' {
  try {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO child_code (animal, color, fruit, grade, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(code.animal, code.color, code.fruit, code.grade, code.deviceId, code.createdAt);
    return Number(lastInsertRowid);
  } catch (err) {
    if (isUniqueViolation(err)) return 'taken';
    throw err;
  }
}

function codeFromRow(row: Row): ChildCode {
  return {
    id: Number(row.id),
    animal: row.animal as ChildCode['animal'],
    color: row.color as ChildCode['color'],
    fruit: row.fruit as ChildCode['fruit'],
    grade: Number(row.grade),
    deviceLabel: (row.device_label as string | null) ?? null,
    active: bool(row.active),
    createdAt: String(row.created_at),
  };
}

const CODE_SELECT = 'SELECT c.*, d.label AS device_label FROM child_code c LEFT JOIN device d ON d.id = c.device_id';

export function listCodes(db: Db, filter: { grade?: number; active?: boolean }): ChildCode[] {
  const rows = db
    .prepare(`${CODE_SELECT} WHERE (?1 IS NULL OR c.grade = ?1) AND (?2 IS NULL OR c.active = ?2) ORDER BY c.id DESC`)
    .all(filter.grade ?? null, filter.active === undefined ? null : filter.active ? 1 : 0) as Row[];
  return rows.map(codeFromRow);
}

export function updateCode(db: Db, id: number, patch: { active?: boolean; grade?: number }): ChildCode | undefined {
  if (patch.active !== undefined) db.prepare('UPDATE child_code SET active = ? WHERE id = ?').run(patch.active ? 1 : 0, id);
  if (patch.grade !== undefined) db.prepare('UPDATE child_code SET grade = ? WHERE id = ?').run(patch.grade, id);
  const row = db.prepare(`${CODE_SELECT} WHERE c.id = ?`).get(id) as Row | undefined;
  return row ? codeFromRow(row) : undefined;
}

/** New codes per creation date (UTC date of created_at is close enough for a trend line). */
export function newCodesPerDay(db: Db, sinceIso: string): { day: string; count: number }[] {
  const rows = db
    .prepare('SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM child_code WHERE created_at >= ? GROUP BY day ORDER BY day')
    .all(sinceIso) as Row[];
  return rows.map((row) => ({ day: String(row.day), count: Number(row.n) }));
}

// ── Admin sessions ─────────────────────────────────────────────────────────

export function createAdminSession(db: Db, now: Date, ttlMs: number): string {
  const token = newToken();
  db.prepare('DELETE FROM admin_session WHERE expires_at < ?').run(now.toISOString());
  db.prepare('INSERT INTO admin_session (token_hash, created_at, expires_at) VALUES (?, ?, ?)').run(
    hashToken(token),
    now.toISOString(),
    new Date(now.getTime() + ttlMs).toISOString(),
  );
  return token;
}

export function adminSessionValid(db: Db, token: string, now: Date): boolean {
  const row = db
    .prepare('SELECT 1 FROM admin_session WHERE token_hash = ? AND expires_at > ?')
    .get(hashToken(token), now.toISOString());
  return row !== undefined;
}

export function deleteAdminSession(db: Db, token: string): void {
  db.prepare('DELETE FROM admin_session WHERE token_hash = ?').run(hashToken(token));
}
