// The installable app's files (doc 03): manifest, icons, service worker and offline page.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(import.meta.dirname, '..', '..', 'web');
const PUBLIC = join(WEB, 'public');
const read = (path: string) => readFileSync(join(PUBLIC, path), 'utf8');

type Icon = { src: string; sizes: string; type: string; purpose: string };
type Manifest = { id: string; name: string; start_url: string; scope: string; display: string; lang: string; icons: Icon[] };
const manifest = JSON.parse(read('manifest.webmanifest')) as Manifest;

/** Width × height from a PNG's IHDR chunk. */
function pngSize(path: string): string {
  const png = readFileSync(join(PUBLIC, path));
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

/** The precache list in sw.js (`const OFFLINE = [...]`). */
function precached(): string[] {
  const list = /const OFFLINE = (\[[^\]]*\]);/.exec(read('sw.js'))?.[1] ?? '[]';
  return JSON.parse(list.replaceAll("'", '"')) as string[];
}

describe('installable app (doc 03)', () => {
  it('has a manifest that opens the kiosk and covers the admin', () => {
    expect(manifest).toMatchObject({ id: '/', name: 'Wie isses?', start_url: '/', scope: '/', display: 'standalone', lang: 'de' });
  });

  it('lists only icons that exist, PNGs at the size they claim', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(PUBLIC, icon.src)), icon.src).toBe(true);
      if (icon.type === 'image/png') expect(pngSize(icon.src), icon.src).toBe(icon.sizes);
    }
  });

  it('has the icons installers ask for: 192 and 512 PNG, and a maskable one', () => {
    const png = (sizes: string, purpose: string) => manifest.icons.some((i) => i.type === 'image/png' && i.sizes === sizes && i.purpose === purpose);
    expect(png('192x192', 'any')).toBe(true);
    expect(png('512x512', 'any')).toBe(true);
    expect(png('512x512', 'maskable')).toBe(true);
    expect(pngSize('icons/apple-touch-icon.png')).toBe('180x180');
  });

  it('lets the service worker answer page loads only, from the network first', () => {
    const sw = read('sw.js');
    expect(sw).toContain("if (event.request.mode !== 'navigate') return;");
    expect(sw).toContain('fetch(event.request).catch(');
    expect(sw).not.toMatch(/\/api|\/media|\/assets/);
    expect(sw).not.toMatch(/cache\.put/);
  });

  it('caches exactly what the offline page needs, and nothing else', () => {
    const page = read('offline.html');
    const used = [...page.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
    expect(new Set(precached())).toEqual(new Set(['/offline.html', ...used]));
  });

  it('keeps the offline page within the CSP: no inline style or script', () => {
    const page = read('offline.html');
    expect(page).not.toMatch(/<style|<script|style="/);
  });

  it('links the manifest from both pages', () => {
    for (const page of ['index.html', 'admin/index.html']) {
      expect(readFileSync(join(WEB, page), 'utf8')).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    }
  });
});
