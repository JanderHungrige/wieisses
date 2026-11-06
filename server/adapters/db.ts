// The only place that opens SQLite. Schema lives here and is migrated at startup by
// PRAGMA user_version; an existing database is backed up before any migration runs.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

export type Db = DatabaseSync;

const MIGRATIONS: readonly string[] = Object.freeze([
  `
  CREATE TABLE topic (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    image_url TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE question (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topic(id),
    kind TEXT NOT NULL CHECK (kind IN ('scale5', 'scale3', 'yesno', 'choice')),
    multi INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    icon TEXT NOT NULL,
    image_url TEXT,
    audio_url TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('core', 'extended')),
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE INDEX question_topic ON question(topic_id);
  CREATE TABLE answer_option (
    id INTEGER PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES question(id),
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    image_url TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX option_question ON answer_option(question_id);
  CREATE TABLE device (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT,
    revoked INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE child_code (
    id INTEGER PRIMARY KEY,
    animal TEXT NOT NULL,
    color TEXT NOT NULL,
    fruit TEXT NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
    device_id INTEGER REFERENCES device(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE (animal, color, fruit)
  );
  CREATE TABLE submission (
    id INTEGER PRIMARY KEY,
    code_id INTEGER NOT NULL REFERENCES child_code(id),
    topic_id INTEGER NOT NULL REFERENCES topic(id),
    day TEXT NOT NULL,
    extended INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (code_id, topic_id, day)
  );
  CREATE INDEX submission_day ON submission(day);
  CREATE INDEX submission_topic_day ON submission(topic_id, day);
  CREATE TABLE answer (
    id INTEGER PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submission(id),
    question_id INTEGER NOT NULL REFERENCES question(id),
    value INTEGER,
    option_id INTEGER REFERENCES answer_option(id),
    CHECK ((value IS NULL) <> (option_id IS NULL))
  );
  CREATE INDEX answer_question ON answer(question_id);
  CREATE INDEX answer_submission ON answer(submission_id);
  CREATE INDEX answer_option_id ON answer(option_id);
  CREATE TABLE admin_session (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // v2 — Thorsten voice clips, one per distinct spoken text (doc 01, "Voice").
  `
  CREATE TABLE voice_clip (
    key TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
]);

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Opens (and creates) the database; ':memory:' for tests. */
export function openDatabase(file: string): Db {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  return db;
}

export function schemaVersion(db: Db): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  return row.user_version;
}

/** Brings the schema up to date. Returns the version it started from. */
export async function migrate(db: Db, backupDir: string | null, now: Date): Promise<number> {
  const from = schemaVersion(db);
  if (from === SCHEMA_VERSION) return from;
  if (from > SCHEMA_VERSION) throw new Error(`database schema ${from} is newer than this build (${SCHEMA_VERSION})`);
  if (from > 0 && backupDir) {
    mkdirSync(backupDir, { recursive: true });
    await backup(db, join(backupDir, `pre-migration-v${from}-${now.toISOString().replace(/[:.]/g, '-')}.sqlite`));
  }
  for (let version = from; version < SCHEMA_VERSION; version++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version] ?? '');
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return from;
}

/** Runs `work` in a write transaction taken up front (BEGIN IMMEDIATE), so a check-then-insert cannot race. */
export function transaction<T>(db: Db, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/.test(err.message);
}

export function bool(value: unknown): boolean {
  return value === 1 || value === 1n || value === true;
}
