import { describe, it, expect } from 'vitest';
import { builtFiles, isNewBuild, newBuildServed } from '../../web/lib/app-version.ts';

// The <head> Vite builds for the kiosk (as served on 2026-11-08).
const page = (js: string, css: string) => `<head>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
    <title>Wie isses?</title>
    <script type="module" crossorigin src="/assets/${js}"></script>
    <link rel="modulepreload" crossorigin href="/assets/api-gwAdWA02.js">
    <link rel="stylesheet" crossorigin href="/assets/${css}">
  </head>`;
const running = page('kiosk-DNZik8_h.js', 'kiosk-7iMlvXBh.css');

describe('Kiosk build check (web/lib/app-version.ts)', () => {
  it('lists the built files a page references, sorted and once each', () => {
    expect(builtFiles(running + running)).toEqual([
      '/assets/api-gwAdWA02.js',
      '/assets/kiosk-7iMlvXBh.css',
      '/assets/kiosk-DNZik8_h.js',
    ]);
  });

  it('lists nothing for the Vite dev server page or an error page', () => {
    expect(builtFiles('<script type="module" src="/kiosk/main.tsx"></script>')).toEqual([]);
    expect(builtFiles('<html><body>502 Bad Gateway</body></html>')).toEqual([]);
  });

  it('sees a new build when the script or only the stylesheet changed', () => {
    const mine = builtFiles(running);
    expect(isNewBuild(mine, builtFiles(running))).toBe(false);
    expect(isNewBuild(mine, builtFiles(page('kiosk-Xy12ab34.js', 'kiosk-7iMlvXBh.css')))).toBe(true);
    expect(isNewBuild(mine, builtFiles(page('kiosk-DNZik8_h.js', 'kiosk-Qq99zz00.css')))).toBe(true);
  });

  it('never sees a new build when either side lists no built files', () => {
    expect(isNewBuild(builtFiles(running), [])).toBe(false);
    expect(isNewBuild([], builtFiles(running))).toBe(false);
  });

  it('asks the server for the page and compares it with the running one', async () => {
    const newer = page('kiosk-Xy12ab34.js', 'kiosk-7iMlvXBh.css');
    expect(await newBuildServed(running, async () => newer)).toBe(true);
    expect(await newBuildServed(running, async () => running)).toBe(false);
  });

  it('carries on with the running build when the server cannot be asked', async () => {
    const down = async (): Promise<string> => {
      throw new Error('HTTP 502');
    };
    expect(await newBuildServed(running, down)).toBe(false);
  });
});
