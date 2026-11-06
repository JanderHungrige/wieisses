// Database backups, run inside the container (deploy/backup.sh calls `create` nightly):
//   node server/ops/backup.ts create  [--dest /data/backups] [--keep 14]
//   node server/ops/backup.ts verify  <file.sqlite.gz>
//   node server/ops/backup.ts restore <file.sqlite.gz> <target.sqlite> [--replace]
// The copy uses SQLite's online backup API, so the app keeps serving, and is kept only after
// PRAGMA integrity_check says "ok". The last line `create` prints is the new file's path.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { gunzipSync, gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? (args[at + 1] ?? fallback) : fallback;
};
const live = join(process.env.DATA_DIR ?? '/data', 'wieisses.sqlite');

function removeWithSidecars(file: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${file}${suffix}`, { force: true });
}

/** A copy inherits WAL mode; a standalone file should not need -wal/-shm sidecars. */
function standalone(file: string): void {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = DELETE');
  db.close();
}

function check(file: string): string {
  standalone(file);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    const counts = db.prepare('SELECT (SELECT COUNT(*) FROM submission) AS submissions, (SELECT COUNT(*) FROM child_code) AS codes').get();
    if (row.integrity_check !== 'ok') throw new Error(`integrity_check: ${row.integrity_check}`);
    return JSON.stringify(counts);
  } finally {
    db.close();
  }
}

// Scratch copies go next to the backups on the data volume: the container's /tmp is a small tmpfs.
function unzipToTemp(gz: string): string {
  const file = join(dirname(gz), `.check-${process.pid}.sqlite`);
  writeFileSync(file, gunzipSync(readFileSync(gz)));
  return file;
}

async function create(): Promise<void> {
  const dest = flag('--dest', '/data/backups');
  const keep = Number(flag('--keep', '14'));
  mkdirSync(dest, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const raw = join(dest, `.wieisses-${stamp}.sqlite`);
  const db = new DatabaseSync(live, { readOnly: true });
  try {
    await backup(db, raw);
  } finally {
    db.close();
  }
  const counts = check(raw);
  const target = join(dest, `wieisses-${stamp}.sqlite.gz`);
  writeFileSync(target, gzipSync(readFileSync(raw)));
  removeWithSidecars(raw);
  const old = readdirSync(dest).filter((f) => /^wieisses-.*\.sqlite\.gz$/.test(f)).sort().slice(0, -keep);
  for (const f of old) rmSync(join(dest, f));
  console.log(`checked ${counts}, rotated ${old.length}`);
  console.log(target);
}

function verify(gz: string): void {
  const file = unzipToTemp(gz);
  try {
    console.log(`ok ${check(file)}`);
  } finally {
    removeWithSidecars(file);
  }
}

function restore(gz: string, target: string): void {
  if (existsSync(target) && !args.includes('--replace')) {
    throw new Error(`${target} exists — stop the app and add --replace to overwrite it`);
  }
  const file = unzipToTemp(gz);
  check(file);
  for (const side of ['-wal', '-shm']) rmSync(`${target}${side}`, { force: true });
  writeFileSync(target, readFileSync(file));
  removeWithSidecars(file);
  console.log(`restored ${gz} → ${target}`);
}

const [command, a, b] = args;
if (command === 'create') await create();
else if (command === 'verify' && a) verify(a);
else if (command === 'restore' && a && b) restore(a, b);
else {
  console.error('usage: backup.ts create [--dest dir] [--keep n] | verify <file.gz> | restore <file.gz> <target> [--replace]');
  process.exit(2);
}
