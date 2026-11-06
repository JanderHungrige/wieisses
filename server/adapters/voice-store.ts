// Thorsten clips: a row per spoken text and its MP3 under /data/media. A re-voiced text gets a
// new file name, so a tablet never keeps playing the old recording from its cache.
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { newFileId } from '../domain/secrets.ts';
import type { Db } from './db.ts';

export type Clip = { key: string; text: string; url: string };

export function allClips(db: Db): Clip[] {
  return db.prepare('SELECT key, text, url FROM voice_clip').all() as Clip[];
}

/** key → url for every stored clip. */
export function clipUrls(db: Db): Map<string, string> {
  return new Map(allClips(db).map((clip) => [clip.key, clip.url]));
}

async function removeFile(mediaDir: string, url: string): Promise<void> {
  const name = url.replace(/^\/media\//, '');
  await unlink(join(mediaDir, name)).catch(() => undefined);
}

/** Stores (or replaces) the clip for `key`; returns its URL. */
export async function saveClip(db: Db, mediaDir: string, clip: { key: string; text: string; mp3: Buffer; now: Date }): Promise<string> {
  const url = `/media/${newFileId()}.mp3`;
  await writeFile(join(mediaDir, url.slice('/media/'.length)), clip.mp3, { flag: 'wx' });
  const old = db.prepare('SELECT url FROM voice_clip WHERE key = ?').get(clip.key) as { url: string } | undefined;
  db.prepare(
    'INSERT INTO voice_clip (key, text, url, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET url = excluded.url, created_at = excluded.created_at',
  ).run(clip.key, clip.text, url, clip.now.toISOString());
  if (old) await removeFile(mediaDir, old.url);
  return url;
}

/** Deletes every clip whose key is not in `keep`; returns how many went. */
export async function pruneClips(db: Db, mediaDir: string, keep: ReadonlySet<string>): Promise<number> {
  const stale = allClips(db).filter((clip) => !keep.has(clip.key));
  for (const clip of stale) {
    db.prepare('DELETE FROM voice_clip WHERE key = ?').run(clip.key);
    await removeFile(mediaDir, clip.url);
  }
  return stale.length;
}
