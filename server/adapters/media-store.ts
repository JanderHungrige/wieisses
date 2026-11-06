// Uploaded pictures and recordings, one file each under /data/media with a random name.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { newFileId } from '../domain/secrets.ts';

/** Writes the bytes and returns the public URL, e.g. /media/<32 hex>.png. */
export async function storeMedia(mediaDir: string, ext: string, bytes: Buffer): Promise<string> {
  await mkdir(mediaDir, { recursive: true });
  const name = `${newFileId()}.${ext}`;
  await writeFile(join(mediaDir, name), bytes, { flag: 'wx' });
  return `/media/${name}`;
}
