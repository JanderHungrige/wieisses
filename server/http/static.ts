// Serves the built SPA from dist/ and uploaded media from /data/media. Every path is resolved
// and confined to its directory; media names must match the generated pattern exactly.
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { MEDIA_FILE } from '../../shared/schema.ts';
import type { Reply } from './reply.ts';

const TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
});

async function fileReply(file: string, cache: string): Promise<Reply | undefined> {
  try {
    const info = await stat(file);
    if (!info.isFile()) return undefined;
    return {
      status: 200,
      raw: await readFile(file),
      type: TYPES[extname(file)] ?? 'application/octet-stream',
      headers: { 'Cache-Control': cache },
    };
  } catch {
    return undefined;
  }
}

function confined(root: string, relative: string): string | undefined {
  const full = resolve(root, `.${relative}`);
  return full === root || full.startsWith(root + sep) ? full : undefined;
}

/** A file of the built app; the page itself for '/' and any '/admin/…' client route. */
export async function serveStatic(root: string, pathname: string): Promise<Reply | undefined> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0')) return undefined;
  const hashed = decoded.startsWith('/assets/');
  const file = confined(root, decoded);
  if (file && decoded !== '/' && !decoded.endsWith('/')) {
    const reply = await fileReply(file, hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (reply) return reply;
  }
  if (hashed) return undefined;
  if (decoded === '/admin' || decoded.startsWith('/admin/')) return fileReply(join(root, 'admin', 'index.html'), 'no-cache');
  if (decoded === '/' || decoded === '/index.html') return fileReply(join(root, 'index.html'), 'no-cache');
  return undefined;
}

export async function serveMedia(mediaDir: string, name: string): Promise<Reply | undefined> {
  if (!MEDIA_FILE.test(name)) return undefined;
  return fileReply(join(mediaDir, name), 'public, max-age=31536000, immutable');
}
