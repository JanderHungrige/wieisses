// Draws the app icon — Springy sitting on the sun (doc 03, "App icon") — from Springy's own body
// path and face, writes the SVGs to web/public/icons/ and renders the PNGs with macOS QuickLook.
// Re-run after changing the icon and commit the results. macOS only (qlmanage).
//   node dev/app-icons.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BODY } from '../web/kiosk/springy-body.ts';

const OUT = join(import.meta.dirname, '..', 'web', 'public', 'icons');
const SUN = '#ffd54a';
const SUN_RING = '#8a5a00';
const INK = '#14164f';

// Springy as in Springy.tsx, at rest: its drawing spans x -8…301, y -54…258 (centre 146.5, 102).
const EYES = [
  { x: 122, y: 10 },
  { x: 186, y: 15 },
];
const SPRINGY = [
  `<path d="${BODY}" fill="#0000bd" stroke="${INK}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>`,
  `<g fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"><path d="M98 -30 Q122 -46 146 -32"/><path d="M164 -27 Q188 -42 210 -22"/></g>`,
  ...EYES.map(
    (e) =>
      `<circle cx="${e.x}" cy="${e.y}" r="30" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
      `<circle cx="${e.x}" cy="${e.y + 2}" r="13" fill="#10123a"/><circle cx="${e.x - 5}" cy="${e.y - 3}" r="5" fill="#fff"/>`,
  ),
  `<path d="M140 56 Q154 69 168 56" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
].join('');

/** Springy scaled by `scale` and centred on the 512 × 512 canvas. */
function springy(scale: number): string {
  const x = 256 - 146.5 * scale;
  const y = 256 - 102 * scale;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})">${SPRINGY}</g>`;
}

const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${inner}</svg>\n`;

// "any": a sun disc on transparency. "maskable": sun-yellow to the edges, Springy inside the
// central 80 % safe zone (a circle of radius 205 around the centre).
const ICONS = {
  'icon.svg': svg(`<circle cx="256" cy="256" r="242" fill="${SUN}" stroke="${SUN_RING}" stroke-width="10"/>${springy(1.12)}`),
  'icon-maskable.svg': svg(`<rect width="512" height="512" fill="${SUN}"/>${springy(0.88)}`),
};

const PNGS: readonly [svg: keyof typeof ICONS, png: string, size: number][] = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180], // iOS rounds the corners itself, wants no transparency
];

for (const [name, content] of Object.entries(ICONS)) writeFileSync(join(OUT, name), content);
for (const [source, png, size] of PNGS) {
  const work = mkdtempSync(join(tmpdir(), 'wieisses-icon-'));
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', work, join(OUT, source)], { stdio: 'ignore' });
  renameSync(join(work, `${source}.png`), join(OUT, png));
  console.log(`${png} (${size} px)`);
}
