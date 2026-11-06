// Starts the real HTTP server on a random port with an in-memory database and a settable clock.
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerDevice } from '../../server/adapters/access-store.ts';
import { insertOption, insertQuestion, insertTopic } from '../../server/adapters/content-write.ts';
import { migrate, openDatabase, type Db } from '../../server/adapters/db.ts';
import { createAppContext, type App } from '../../server/context.ts';
import { silentLog } from '../../server/log.ts';
import { seedIfEmpty } from '../../server/seed.ts';
import { createServer } from '../../server/server.ts';

export const PASSWORD = 'test-password-123';
export const THURSDAY = '2026-11-05T10:00:00Z';
export const FRIDAY = '2026-11-06T10:00:00Z';

export type Res = { status: number; body: unknown; text: string; headers: Headers };

/** The response body as the documented shape — the assertions that follow check it. */
export function bodyOf<T>(res: Res): T {
  return res.body as T;
}

export function errorOf(res: Res): string {
  return (res.body as { error?: string } | undefined)?.error ?? `<no error body, status ${res.status}>`;
}
export type Call = { method?: string; json?: unknown; raw?: Buffer; type?: string; cookie?: string; bearer?: string; csrf?: boolean; ip?: string };

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;

export async function startTestApp(options: { seed?: boolean; now?: string; voiceUrl?: string } = {}) {
  const db = openDatabase(':memory:');
  let now = new Date(options.now ?? THURSDAY);
  await migrate(db, null, now);
  if (options.seed) seedIfEmpty(db, now);
  const mediaDir = mkdtempSync(join(tmpdir(), 'wieisses-media-'));
  const app: App = createAppContext({
    db,
    env: 'test',
    mediaDir,
    staticDir: join(tmpdir(), 'wieisses-no-dist'),
    adminPassword: PASSWORD,
    log: silentLog,
    voiceUrl: options.voiceUrl ?? null,
    now: () => now,
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call(path: string, c: Call = {}): Promise<Res> {
    const headers: Record<string, string> = {};
    if (c.csrf !== false) headers['X-Wieisses'] = '1';
    if (c.cookie) headers.Cookie = c.cookie;
    if (c.bearer) headers.Authorization = `Bearer ${c.bearer}`;
    if (c.ip) headers['X-Forwarded-For'] = c.ip;
    let body: RequestInit['body'];
    if (c.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(c.json);
    } else if (c.raw) {
      headers['Content-Type'] = c.type ?? 'application/octet-stream';
      body = new Uint8Array(c.raw);
    }
    const res = await fetch(base + path, { method: c.method ?? (body ? 'POST' : 'GET'), headers, body });
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    return { status: res.status, body: parsed, text, headers: res.headers };
  }

  return {
    app,
    db,
    base,
    call,
    setNow(iso: string) {
      now = new Date(iso);
    },
    /** A registered tablet's cookie header. */
    device(label = 'Tablet 1'): { cookie: string; id: number } {
      const { device, token } = registerDevice(db, label, now);
      return { cookie: `wi_device=${token}`, id: device.id };
    },
    async adminCookie(): Promise<string> {
      const res = await call('/api/v1/admin/login', { json: { password: PASSWORD } });
      const setCookie = res.headers.get('set-cookie') ?? '';
      return setCookie.split(';')[0] ?? '';
    },
    async close() {
      await app.voice.idle();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
      rmSync(mediaDir, { recursive: true, force: true });
    },
  };
}

/** Two topics: Essen (scale5 core, yesno extended, multi choice core) and Hausaufgaben (scale3 core). */
export function fixture(db: Db) {
  const now = new Date(THURSDAY);
  const base = { imageUrl: null, audioUrl: null, sort: 0, active: true, multi: false, frequency: 'core' as const };
  const essen = insertTopic(db, { name: 'Essen', color: '#f7a541', icon: '🍽️', imageUrl: null, sort: 0, active: true }, now);
  const taste = insertQuestion(db, essen.id, { ...base, kind: 'scale5', text: 'Wie hat es geschmeckt?', icon: '🍝' }, now);
  const enough = insertQuestion(db, essen.id, { ...base, kind: 'yesno', text: 'Genug Zeit?', icon: '⏰', frequency: 'extended', sort: 1 }, now);
  const likes = insertQuestion(db, essen.id, { ...base, kind: 'choice', multi: true, text: 'Was magst du?', icon: '🍴', sort: 2 }, now);
  const pasta = insertOption(db, likes.id, { label: 'Nudeln', icon: '🍝', imageUrl: null, sort: 0, active: true });
  const pizza = insertOption(db, likes.id, { label: 'Pizza', icon: '🍕', imageUrl: null, sort: 1, active: true });
  const hausaufgaben = insertTopic(db, { name: 'Hausaufgaben', color: '#5aa9e6', icon: '📚', imageUrl: null, sort: 1, active: true }, now);
  const quiet = insertQuestion(db, hausaufgaben.id, { ...base, kind: 'scale3', text: 'War es ruhig?', icon: '🤫' }, now);
  return { essen, taste, enough, likes, pasta, pizza, hausaufgaben, quiet };
}
