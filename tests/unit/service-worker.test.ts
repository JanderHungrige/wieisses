// The installable app's service worker (doc 03, "Service worker"), run in a sandbox with fake
// caches and network: it precaches the offline page, answers failed page loads with it, and leaves
// every other request alone.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const SOURCE = readFileSync(join(import.meta.dirname, '..', '..', 'web', 'public', 'sw.js'), 'utf8');

type Listener = (event: unknown) => void;
let listeners: Map<string, Listener>;
let stores: Map<string, Map<string, string>>;
let network: (url: string) => Promise<string>;
let skipped: boolean;
let claimed: boolean;

function load(): void {
  listeners = new Map();
  skipped = false;
  claimed = false;
  const worker = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: async () => void (skipped = true),
    clients: { claim: async () => void (claimed = true) },
  };
  const store = (name: string) => {
    const entries = stores.get(name) ?? new Map<string, string>();
    stores.set(name, entries);
    return {
      addAll: async (urls: string[]) => urls.forEach((url) => entries.set(url, `cached ${url}`)),
      keys: async () => [...entries.keys()],
    };
  };
  const caches = {
    open: async (name: string) => store(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (url: string) => [...stores.values()].find((entries) => entries.has(url))?.get(url),
  };
  runInNewContext(SOURCE, { self: worker, caches, fetch: (request: { url: string }) => network(request.url), Response: { error: () => 'network error' } });
}

/** Fires `type` and waits for everything it handed to waitUntil / respondWith. */
async function fire(type: string, fields: Record<string, unknown> = {}): Promise<{ answered: boolean; response: unknown }> {
  const pending: Promise<unknown>[] = [];
  let answer: Promise<unknown> | undefined;
  listeners.get(type)?.({ ...fields, waitUntil: (p: Promise<unknown>) => pending.push(p), respondWith: (p: Promise<unknown>) => (answer = p) });
  await Promise.all(pending);
  return { answered: answer !== undefined, response: await answer };
}

const navigate = (url: string) => fire('fetch', { request: { mode: 'navigate', url } });

beforeEach(() => {
  stores = new Map([['old-cache', new Map([['/x', 'stale']])]]);
  network = async (url) => `network ${url}`;
  load();
});

describe('service worker (web/public/sw.js)', () => {
  it('precaches the offline page and takes over at once', async () => {
    await fire('install');
    expect([...(stores.get('wieisses-offline-v1')?.keys() ?? [])]).toEqual(['/offline.html', '/offline.css', '/icons/icon.svg']);
    expect(skipped).toBe(true);
  });

  it('deletes every other cache on activate and claims the open pages', async () => {
    await fire('install');
    await fire('activate');
    expect([...stores.keys()]).toEqual(['wieisses-offline-v1']);
    expect(claimed).toBe(true);
  });

  it('loads pages from the network while it is there', async () => {
    await fire('install');
    expect(await navigate('/')).toEqual({ answered: true, response: 'network /' });
    expect(await navigate('/admin/')).toEqual({ answered: true, response: 'network /admin/' });
  });

  it('answers a page load with the offline page when the network fails', async () => {
    await fire('install');
    network = async () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await navigate('/')).toEqual({ answered: true, response: 'cached /offline.html' });
  });

  it('gives a plain network error when not even the offline page is cached', async () => {
    network = async () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await navigate('/')).toEqual({ answered: true, response: 'network error' });
  });

  it('never touches API calls, assets, media or clips', async () => {
    await fire('install');
    for (const [mode, url] of [['cors', '/api/v1/kiosk/config'], ['cors', '/'], ['no-cors', '/assets/kiosk.js'], ['no-cors', '/media/clip.mp3']]) {
      expect(await fire('fetch', { request: { mode, url } }), url).toEqual({ answered: false, response: undefined });
    }
  });
});
