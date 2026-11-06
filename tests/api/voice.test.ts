import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixedPhrases } from '../../shared/phrases.ts';
import type { AdminTopic, KioskConfig, Settings, VoiceStatus } from '../../shared/schema.ts';
import { allClips } from '../../server/adapters/voice-store.ts';
import { startFakeVoice, type FakeVoice } from './fake-voice.ts';
import { bodyOf, errorOf, fixture, startTestApp, type TestApp } from './harness.ts';

let voice: FakeVoice;
let t: TestApp;
let f: ReturnType<typeof fixture>;
let admin: string;

// Fixture content the kiosk speaks: 2 topic names, 3 active question texts, 2 option labels.
const CONTENT = ['Essen', 'Hausaufgaben', 'Wie hat es geschmeckt?', 'Genug Zeit?', 'Was magst du?', 'Nudeln', 'Pizza', 'War es ruhig?'];

beforeEach(async () => {
  voice = await startFakeVoice();
  t = await startTestApp({ voiceUrl: voice.url });
  f = fixture(t.db);
  admin = await t.adminCookie();
});
afterEach(async () => {
  await t.close();
  await voice.close();
});

async function generate(mode: 'missing' | 'all' = 'missing'): Promise<VoiceStatus> {
  const res = await t.call('/api/v1/admin/voice/generate', { cookie: admin, json: { mode } });
  expect(res.status).toBe(202);
  await t.app.voice.idle();
  return bodyOf<VoiceStatus>(await t.call('/api/v1/admin/voice', { cookie: admin }));
}

async function config(): Promise<KioskConfig> {
  const tablet = t.device();
  return bodyOf<KioskConfig>(await t.call('/api/v1/kiosk/config', { cookie: tablet.cookie }));
}

describe('Voice API (fake voice service)', () => {
  describe('POST /api/v1/admin/voice/generate {mode: "missing"}', () => {
    it('voices every wanted text without a clip and reports ready = total', async () => {
      const status = await generate();
      const total = fixedPhrases().length + CONTENT.length;
      expect(status).toMatchObject({ configured: true, reachable: true, total, ready: total, queued: 0, working: null, failed: [] });
      expect(voice.requests).toHaveLength(total);
      expect(new Set(voice.requests.map((r) => r.lengthScale))).toEqual(new Set([1.11]));
      await generate();
      expect(voice.requests).toHaveLength(total);
    });

    it('stores each clip as /media/<32 hex>.mp3 that the media route serves as audio/mpeg', async () => {
      await generate();
      const clip = allClips(t.db).find((c) => c.text === 'Wie hat es geschmeckt?');
      expect(clip?.url).toMatch(/^\/media\/[a-f0-9]{32}\.mp3$/);
      const res = await fetch(t.base + (clip?.url ?? ''));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/mpeg');
      expect(await res.text()).toBe('ID3 1.11 Wie hat es geschmeckt?');
    });

    it('answers 503 voice_unavailable when no voice service is configured', async () => {
      const plain = await startTestApp();
      const cookie = await plain.adminCookie();
      const res = await plain.call('/api/v1/admin/voice/generate', { cookie, json: { mode: 'missing' } });
      expect(res.status).toBe(503);
      expect(errorOf(res)).toBe('voice_unavailable');
      expect(bodyOf<VoiceStatus>(await plain.call('/api/v1/admin/voice', { cookie })).configured).toBe(false);
      await plain.close();
    });
  });

  describe('kiosk config', () => {
    it('maps each voiced text to its clip url, fixed phrases included', async () => {
      await generate();
      const c = await config();
      for (const text of ['Danke!', 'Fuchs', 'Super', 'Klasse 3', 'Essen', 'Wie hat es geschmeckt?', 'Nudeln']) {
        expect(c.voice[text]).toMatch(/^\/media\/[a-f0-9]{32}\.mp3$/);
      }
      expect(c.voice['Genug Zeit?']).toBeUndefined(); // extended question, not shown on a Thursday
    });

    it('still works without clips when the voice service is down', async () => {
      await voice.close();
      const res = await t.call('/api/v1/admin/voice/generate', { cookie: admin, json: { mode: 'missing' } });
      expect(res.status).toBe(202);
      await t.app.voice.idle();
      const c = await config();
      expect(c.topics.map((topic) => topic.name)).toEqual(['Essen', 'Hausaufgaben']);
      expect(c.voice).toEqual({});
      voice = await startFakeVoice(); // afterEach closes it again
    });
  });

  describe('saving content', () => {
    it('does not voice anything by itself — a changed question text stays without clip until generate', async () => {
      const before = (await generate()).total;
      const patched = await t.call(`/api/v1/admin/questions/${f.taste.id}`, { method: 'PATCH', cookie: admin, json: { text: 'Wie war das Essen?' } });
      expect(patched.status).toBe(200);
      await t.app.voice.idle();
      expect(voice.requests).toHaveLength(before);
      const status = bodyOf<VoiceStatus>(await t.call('/api/v1/admin/voice', { cookie: admin }));
      expect(status).toMatchObject({ total: before, ready: before - 1, queued: 0 });
    });

    it('after generate the new text has a clip and the old text clip is cleaned up', async () => {
      await generate();
      const old = allClips(t.db).find((c) => c.text === 'Wie hat es geschmeckt?');
      await t.call(`/api/v1/admin/questions/${f.taste.id}`, { method: 'PATCH', cookie: admin, json: { text: 'Wie war das Essen?' } });
      const status = await generate();
      expect(status.ready).toBe(status.total);
      expect(voice.requests.at(-1)?.text).toBe('Wie war das Essen?');
      const texts = allClips(t.db).map((c) => c.text);
      expect(texts).toContain('Wie war das Essen?');
      expect(texts).not.toContain('Wie hat es geschmeckt?');
      expect((await fetch(t.base + (old?.url ?? ''))).status).toBe(404);
    });

    it('lists voiceUrl for topics, questions and options in GET /api/v1/admin/topics', async () => {
      await generate();
      const topics = bodyOf<AdminTopic[]>(await t.call('/api/v1/admin/topics', { cookie: admin }));
      const essen = topics.find((x) => x.id === f.essen.id);
      expect(essen?.voiceUrl).toMatch(/^\/media\//);
      expect(essen?.questions.find((q) => q.id === f.taste.id)?.voiceUrl).toMatch(/^\/media\//);
      expect(essen?.questions.find((q) => q.id === f.likes.id)?.options.map((o) => typeof o.voiceUrl)).toEqual(['string', 'string']);
    });
  });

  describe('settings', () => {
    it('a changed speechRate re-voices every text with the new lengthScale', async () => {
      const total = (await generate()).total;
      const settings = bodyOf<Settings>(await t.call('/api/v1/admin/settings', { cookie: admin }));
      const res = await t.call('/api/v1/admin/settings', { method: 'PUT', cookie: admin, json: { ...settings, speechRate: 0.8 } });
      expect(res.status).toBe(200);
      await t.app.voice.idle();
      const again = voice.requests.slice(total);
      expect(again).toHaveLength(total);
      expect(new Set(again.map((r) => r.lengthScale))).toEqual(new Set([1.25]));
      expect(allClips(t.db)).toHaveLength(total);
      const unchanged = await t.call('/api/v1/admin/settings', { method: 'PUT', cookie: admin, json: { ...settings, speechRate: 0.8, idleSeconds: 120 } });
      expect(unchanged.status).toBe(200);
      await t.app.voice.idle();
      expect(voice.requests).toHaveLength(2 * total);
    });
  });

  describe('POST /api/v1/admin/voice/clip', () => {
    it('re-voices one wanted text', async () => {
      await generate();
      const before = allClips(t.db).find((c) => c.text === 'Danke!')?.url;
      const res = await t.call('/api/v1/admin/voice/clip', { cookie: admin, json: { text: '  Danke! ' } });
      expect(res.status).toBe(202);
      await t.app.voice.idle();
      expect(voice.requests.at(-1)?.text).toBe('Danke!');
      const after = allClips(t.db).find((c) => c.text === 'Danke!')?.url;
      expect(after).toMatch(/^\/media\//);
      expect(after).not.toBe(before);
    });

    it('answers 400 for a text the kiosk never speaks', async () => {
      const res = await t.call('/api/v1/admin/voice/clip', { cookie: admin, json: { text: 'Irgendwas anderes' } });
      expect(res.status).toBe(400);
      expect(errorOf(res)).toBe('validation');
    });
  });

  describe('GET /api/v1/admin/voice', () => {
    it('reports reachable = false and the failed texts when the voice service is down', async () => {
      voice.failOn('Danke!');
      const partial = await generate();
      expect(partial.failed).toEqual([{ text: 'Danke!', message: expect.stringContaining('500') }]);
      expect(partial.ready).toBe(partial.total - 1);
      await voice.close();
      await t.call(`/api/v1/admin/topics/${f.essen.id}`, { method: 'PATCH', cookie: admin, json: { name: 'Mittagessen' } });
      const down = await generate();
      // The run stops at the first unreachable answer; "Mittagessen" was never tried, so it is
      // missing (not failed) and the next run picks it up.
      expect(down.reachable).toBe(false);
      expect(down.failed).toEqual([{ text: 'Danke!', message: expect.stringContaining('nicht erreichbar') }]);
      expect(down.ready).toBe(down.total - 2);
      voice = await startFakeVoice();
    });

    it('requires the admin session', async () => {
      expect((await t.call('/api/v1/admin/voice')).status).toBe(401);
      expect((await t.call('/api/v1/admin/voice/generate', { json: { mode: 'all' } })).status).toBe(401);
      expect((await t.call('/api/v1/admin/voice/clip', { json: { text: 'Danke!' } })).status).toBe(401);
    });
  });
});
