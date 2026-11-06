import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AdminTopic, CodesOverview, Device, Question, Settings, Topic } from '../../shared/schema.ts';
import { PASSWORD, bodyOf, errorOf, fixture, startTestApp, type TestApp } from './harness.ts';

let t: TestApp;
let admin: string;

beforeEach(async () => {
  t = await startTestApp();
  admin = await t.adminCookie();
});
afterEach(() => t.close());

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

describe('Admin API', () => {
  describe('auth', () => {
    it('logs in with the right password: 204 and an HttpOnly SameSite=Strict cookie', async () => {
      const res = await t.call('/api/v1/admin/login', { json: { password: PASSWORD } });
      expect(res.status).toBe(204);
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toMatch(/^wi_admin=[A-Za-z0-9_-]{43};/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Max-Age=43200');
      expect((await t.call('/api/v1/admin/me', { cookie: admin })).status).toBe(200);
    });

    it('returns 401 wrong_password, and 429 after 10 failures from one IP', async () => {
      const wrong = await t.call('/api/v1/admin/login', { json: { password: 'nope' }, ip: '203.0.113.7' });
      expect(wrong.status).toBe(401);
      expect(errorOf(wrong)).toBe('wrong_password');
      for (let i = 0; i < 9; i++) await t.call('/api/v1/admin/login', { json: { password: 'nope' }, ip: '203.0.113.7' });
      const blocked = await t.call('/api/v1/admin/login', { json: { password: PASSWORD }, ip: '203.0.113.7' });
      expect(blocked.status).toBe(429);
      const otherIp = await t.call('/api/v1/admin/login', { json: { password: PASSWORD }, ip: '203.0.113.8' });
      expect(otherIp.status).toBe(204);
    });

    it('returns 401 not_logged_in on admin routes without a session, and after logout', async () => {
      for (const path of ['/api/v1/admin/me', '/api/v1/admin/topics', '/api/v1/admin/codes', '/api/v1/admin/devices', '/api/v1/admin/settings']) {
        const res = await t.call(path);
        expect(res.status).toBe(401);
        expect(errorOf(res)).toBe('not_logged_in');
      }
      const out = await t.call('/api/v1/admin/logout', { method: 'POST', cookie: admin });
      expect(out.status).toBe(204);
      expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
      expect((await t.call('/api/v1/admin/me', { cookie: admin })).status).toBe(401);
    });
  });

  describe('topics, questions, options', () => {
    it('creates, lists and updates a topic', async () => {
      const made = await t.call('/api/v1/admin/topics', { cookie: admin, json: { name: 'Pause', color: '#4fc9c4', icon: '⏸️' } });
      expect(made.status).toBe(201);
      const topic = bodyOf<Topic>(made);
      expect(topic).toMatchObject({ name: 'Pause', color: '#4fc9c4', imageUrl: null, sort: 0, active: true });
      const patched = await t.call(`/api/v1/admin/topics/${topic.id}`, { method: 'PATCH', cookie: admin, json: { name: 'Pausenhof', active: false } });
      expect(bodyOf<Topic>(patched)).toMatchObject({ id: topic.id, name: 'Pausenhof', active: false, color: '#4fc9c4' });
      const list = bodyOf<AdminTopic[]>(await t.call('/api/v1/admin/topics', { cookie: admin }));
      expect(list.map((x) => [x.name, x.active, x.answerCount])).toEqual([['Pausenhof', false, 0]]);
      const bad = await t.call('/api/v1/admin/topics', { cookie: admin, json: { name: '', color: 'red', icon: 'x' } });
      expect(bad.status).toBe(400);
    });

    it('creates a choice question with options, and refuses options on a scale question', async () => {
      const topic = bodyOf<Topic>(await t.call('/api/v1/admin/topics', { cookie: admin, json: { name: 'Pause', color: '#4fc9c4', icon: '⏸️' } }));
      const choice = bodyOf<Question>(
        await t.call(`/api/v1/admin/topics/${topic.id}/questions`, { cookie: admin, json: { kind: 'choice', multi: true, text: 'Was spielst du?', icon: '⚽' } }),
      );
      expect(choice).toMatchObject({ kind: 'choice', multi: true, frequency: 'core', topicId: topic.id });
      const option = await t.call(`/api/v1/admin/questions/${choice.id}/options`, { cookie: admin, json: { label: 'Fangen', icon: '🏃' } });
      expect(option.status).toBe(201);
      const scale = bodyOf<Question>(
        await t.call(`/api/v1/admin/topics/${topic.id}/questions`, { cookie: admin, json: { kind: 'scale5', multi: true, text: 'Wie war die Pause?', icon: '⏸️' } }),
      );
      expect(scale.multi).toBe(false);
      const refused = await t.call(`/api/v1/admin/questions/${scale.id}/options`, { cookie: admin, json: { label: 'X', icon: '❌' } });
      expect(refused.status).toBe(400);
      const missing = await t.call('/api/v1/admin/topics/999/questions', { cookie: admin, json: { kind: 'yesno', text: 'Ja?', icon: '👍' } });
      expect(missing.status).toBe(404);
    });

    it('deletes an unanswered question but refuses an answered one with 409 in_use', async () => {
      const f = fixture(t.db);
      expect((await t.call(`/api/v1/admin/questions/${f.quiet.id}`, { method: 'DELETE', cookie: admin })).status).toBe(204);
      await answerTaste(t, f);
      const refused = await t.call(`/api/v1/admin/questions/${f.taste.id}`, { method: 'DELETE', cookie: admin });
      expect(refused.status).toBe(409);
      expect(errorOf(refused)).toBe('in_use');
      expect((await t.call(`/api/v1/admin/topics/${f.essen.id}`, { method: 'DELETE', cookie: admin })).status).toBe(409);
      const list = bodyOf<AdminTopic[]>(await t.call('/api/v1/admin/topics', { cookie: admin }));
      expect(list.find((x) => x.id === f.essen.id)?.answerCount).toBe(1);
    });

    it('refuses to change the kind of an answered question', async () => {
      const f = fixture(t.db);
      await answerTaste(t, f);
      const res = await t.call(`/api/v1/admin/questions/${f.taste.id}`, { method: 'PATCH', cookie: admin, json: { kind: 'scale3' } });
      expect(res.status).toBe(409);
      const text = await t.call(`/api/v1/admin/questions/${f.taste.id}`, { method: 'PATCH', cookie: admin, json: { text: 'Wie hat es dir geschmeckt?' } });
      expect(bodyOf<Question>(text)).toMatchObject({ kind: 'scale5', text: 'Wie hat es dir geschmeckt?' });
    });
  });

  describe('POST /api/v1/admin/media', () => {
    it('stores a PNG and returns a /media url that serves it with nosniff', async () => {
      const res = await t.call('/api/v1/admin/media', { cookie: admin, raw: PNG, type: 'image/png' });
      expect(res.status).toBe(201);
      const { url } = bodyOf<{ url: string }>(res);
      expect(url).toMatch(/^\/media\/[a-f0-9]{32}\.png$/);
      const file = await fetch(t.base + url);
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('image/png');
      expect(file.headers.get('x-content-type-options')).toBe('nosniff');
      expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
      expect((await fetch(`${t.base}/media/..%2Fwieisses.sqlite`)).status).toBe(404);
    });

    it('returns 415 when content type and magic bytes disagree, and for SVG', async () => {
      const lying = await t.call('/api/v1/admin/media', { cookie: admin, raw: Buffer.from('<html><script>alert(1)</script></html>'), type: 'image/png' });
      expect(lying.status).toBe(415);
      const svg = await t.call('/api/v1/admin/media', { cookie: admin, raw: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), type: 'image/svg+xml' });
      expect(svg.status).toBe(415);
      expect(errorOf(svg)).toBe('unsupported_type');
    });

    it('returns 413 for an image over 2 MB', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
      const res = await t.call('/api/v1/admin/media', { cookie: admin, raw: big, type: 'image/png' });
      expect(res.status).toBe(413);
      expect(errorOf(res)).toBe('too_large');
    });
  });

  describe('codes', () => {
    it('lists codes with grade and device label, and new codes per day', async () => {
      const tablet = t.device('Tablet Flur');
      await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { animal: 'eule', color: 'lila', fruit: 'birne', grade: 3 } });
      await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { animal: 'hase', color: 'rot', fruit: 'apfel', grade: 1 } });
      const all = bodyOf<CodesOverview>(await t.call('/api/v1/admin/codes', { cookie: admin }));
      expect(all.codes).toHaveLength(2);
      expect(all.codes.find((c) => c.animal === 'eule')).toMatchObject({ color: 'lila', fruit: 'birne', grade: 3, deviceLabel: 'Tablet Flur', active: true });
      expect(all.newPerDay).toEqual([{ day: '2026-11-05', count: 2 }]);
      const third = bodyOf<CodesOverview>(await t.call('/api/v1/admin/codes?grade=3', { cookie: admin }));
      expect(third.codes.map((c) => c.animal)).toEqual(['eule']);
    });

    it('deactivates a code so it can no longer log in', async () => {
      const tablet = t.device();
      const picks = { animal: 'eule', color: 'lila', fruit: 'birne' };
      await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { ...picks, grade: 3 } });
      const [code] = bodyOf<CodesOverview>(await t.call('/api/v1/admin/codes', { cookie: admin })).codes;
      const res = await t.call(`/api/v1/admin/codes/${code?.id}`, { method: 'PATCH', cookie: admin, json: { active: false } });
      expect(res.status).toBe(200);
      expect((await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: picks })).status).toBe(404);
      const inactive = bodyOf<CodesOverview>(await t.call('/api/v1/admin/codes?active=false', { cookie: admin }));
      expect(inactive.codes).toHaveLength(1);
    });
  });

  describe('devices', () => {
    it('registers the calling browser as a device and sets the device cookie', async () => {
      const res = await t.call('/api/v1/admin/devices', { cookie: admin, json: { label: 'Tablet Mensa' } });
      expect(res.status).toBe(201);
      expect(bodyOf<Device>(res)).toMatchObject({ label: 'Tablet Mensa', revoked: false });
      const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
      expect(cookie).toMatch(/^wi_device=/);
      expect(res.headers.get('set-cookie')).toContain('Max-Age=34560000');
      expect((await t.call('/api/v1/kiosk/config', { cookie })).status).toBe(200);
    });

    it('lists devices without tokens and revokes one', async () => {
      const tablet = t.device('Tablet 1');
      const list = await t.call('/api/v1/admin/devices', { cookie: admin });
      expect(list.text).not.toContain(tablet.cookie.split('=')[1]);
      expect(list.text).not.toContain('token');
      const revoked = await t.call(`/api/v1/admin/devices/${tablet.id}`, { method: 'PATCH', cookie: admin, json: { revoked: true } });
      expect(bodyOf<Device>(revoked).revoked).toBe(true);
      expect((await t.call('/api/v1/kiosk/config', { cookie: tablet.cookie })).status).toBe(403);
    });
  });

  describe('settings', () => {
    it('returns the defaults and stores a valid update', async () => {
      const defaults = bodyOf<Settings>(await t.call('/api/v1/admin/settings', { cookie: admin }));
      expect(defaults).toEqual({ title: 'Wie isses?', extendedWeekdays: [5], autoRead: true, speechRate: 0.9, idleSeconds: 90, grades: [1, 2, 3, 4] });
      const next = { ...defaults, extendedWeekdays: [1, 3], idleSeconds: 120, grades: [1, 2, 3, 4, 5, 6] };
      const saved = await t.call('/api/v1/admin/settings', { method: 'PUT', cookie: admin, json: next });
      expect(saved.status).toBe(200);
      expect(bodyOf<Settings>(await t.call('/api/v1/admin/settings', { cookie: admin }))).toEqual(next);
    });

    it('returns 400 for idleSeconds out of range or an invalid weekday', async () => {
      const defaults = bodyOf<Settings>(await t.call('/api/v1/admin/settings', { cookie: admin }));
      for (const bad of [{ ...defaults, idleSeconds: 5 }, { ...defaults, extendedWeekdays: [8] }, { ...defaults, grades: [] }]) {
        const res = await t.call('/api/v1/admin/settings', { method: 'PUT', cookie: admin, json: bad });
        expect(res.status).toBe(400);
        expect(errorOf(res)).toBe('validation');
      }
    });
  });
});

async function answerTaste(app: TestApp, f: ReturnType<typeof fixture>): Promise<void> {
  const tablet = app.device();
  const made = await app.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { animal: 'hund', color: 'gelb', fruit: 'banane', grade: 1 } });
  const { token } = bodyOf<{ token: string }>(made);
  const res = await app.call('/api/v1/kiosk/submissions', {
    cookie: tablet.cookie,
    bearer: token,
    json: { topicId: f.essen.id, answers: [{ questionId: f.taste.id, value: 5 }] },
  });
  expect(res.status).toBe(201);
}
