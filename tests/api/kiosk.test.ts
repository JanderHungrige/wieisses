import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { KioskConfig, KioskSession } from '../../shared/schema.ts';
import { updateCode, updateDevice } from '../../server/adapters/access-store.ts';
import { FRIDAY, bodyOf, errorOf, fixture, startTestApp, type TestApp } from './harness.ts';

let t: TestApp;
let f: ReturnType<typeof fixture>;
let tablet: { cookie: string; id: number };
const fox = { animal: 'fuchs', color: 'blau', fruit: 'apfel' };

beforeEach(async () => {
  t = await startTestApp();
  f = fixture(t.db);
  tablet = t.device();
});
afterEach(() => t.close());

async function newChild(picks = fox, grade = 2): Promise<KioskSession> {
  const res = await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { ...picks, grade } });
  expect(res.status).toBe(201);
  return bodyOf<KioskSession>(res);
}

function answerEssen(token: string) {
  return t.call('/api/v1/kiosk/submissions', {
    cookie: tablet.cookie,
    bearer: token,
    json: { topicId: f.essen.id, answers: [{ questionId: f.taste.id, value: 4 }, { questionId: f.likes.id, optionIds: [f.pasta.id, f.pizza.id] }] },
  });
}

describe('Kiosk API', () => {
  describe('device gate', () => {
    it('answers 403 device_not_registered without a device cookie, on every kiosk route', async () => {
      const calls = [
        t.call('/api/v1/kiosk/config'),
        t.call('/api/v1/kiosk/codes', { json: { ...fox, grade: 1 } }),
        t.call('/api/v1/kiosk/session', { json: fox }),
        t.call('/api/v1/kiosk/submissions', { json: { topicId: f.essen.id, answers: [] } }),
        t.call('/api/v1/kiosk/config', { cookie: 'wi_device=forged-token' }),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(403);
        expect(errorOf(res)).toBe('device_not_registered');
      }
    });

    it('answers 403 for a revoked device', async () => {
      expect((await t.call('/api/v1/kiosk/config', { cookie: tablet.cookie })).status).toBe(200);
      updateDevice(t.db, tablet.id, { revoked: true });
      const res = await t.call('/api/v1/kiosk/config', { cookie: tablet.cookie });
      expect(res.status).toBe(403);
      expect(errorOf(res)).toBe('device_not_registered');
    });
  });

  describe('GET /api/v1/kiosk/config', () => {
    it('returns active topics with core questions only on a normal day', async () => {
      const res = await t.call('/api/v1/kiosk/config', { cookie: tablet.cookie });
      expect(res.status).toBe(200);
      const config = bodyOf<KioskConfig>(res);
      expect(config.today).toBe('2026-11-05');
      expect(config.extendedToday).toBe(false);
      expect(config.settings).toEqual({ autoRead: true, speechRate: 0.9, idleSeconds: 90, grades: [1, 2, 3, 4] });
      expect(config.topics.map((topic) => topic.name)).toEqual(['Essen', 'Hausaufgaben']);
      const essen = config.topics[0];
      expect(essen?.questions.map((q) => q.id)).toEqual([f.taste.id, f.likes.id]);
      expect(essen?.questions[1]?.options.map((o) => o.label)).toEqual(['Nudeln', 'Pizza']);
    });

    it('adds extended questions on an extended weekday', async () => {
      t.setNow(FRIDAY);
      const config = bodyOf<KioskConfig>(await t.call('/api/v1/kiosk/config', { cookie: tablet.cookie }));
      expect(config.extendedToday).toBe(true);
      expect(config.topics[0]?.questions.map((q) => q.id)).toEqual([f.taste.id, f.enough.id, f.likes.id]);
    });
  });

  describe('POST /api/v1/kiosk/codes', () => {
    it('creates a code and returns 201 with a token and no done topics', async () => {
      const session = await newChild();
      expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(session.doneTopicIds).toEqual([]);
      expect(session.expiresInSeconds).toBe(1200);
      const row = t.db.prepare('SELECT grade, device_id FROM child_code').get() as { grade: number; device_id: number };
      expect(row).toEqual({ grade: 2, device_id: tablet.id });
    });

    it('returns 409 code_taken for a combination that exists', async () => {
      await newChild();
      const res = await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { ...fox, grade: 3 } });
      expect(res.status).toBe(409);
      expect(errorOf(res)).toBe('code_taken');
    });

    it('returns 400 for a grade outside the grades setting', async () => {
      const res = await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { ...fox, grade: 5 } });
      expect(res.status).toBe(400);
      expect(errorOf(res)).toBe('validation');
      expect(t.db.prepare('SELECT COUNT(*) AS n FROM child_code').get()).toEqual({ n: 0 });
    });

    it('returns 429 after 10 new codes from one device within 10 minutes', async () => {
      const fruits = ['apfel', 'banane', 'erdbeere', 'trauben', 'birne', 'kirschen', 'zitrone', 'melone', 'apfel', 'banane'];
      for (const [i, fruit] of fruits.entries()) await newChild({ animal: 'fuchs', color: i < 8 ? 'blau' : 'rot', fruit }, 1);
      const res = await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { animal: 'eule', color: 'gelb', fruit: 'birne', grade: 1 } });
      expect(res.status).toBe(429);
      expect(errorOf(res)).toBe('too_many_new_codes');
      const other = t.device('Tablet 2');
      const elsewhere = await t.call('/api/v1/kiosk/codes', { cookie: other.cookie, json: { animal: 'eule', color: 'gelb', fruit: 'birne', grade: 1 } });
      expect(elsewhere.status).toBe(201);
    });
  });

  describe('POST /api/v1/kiosk/session', () => {
    it('returns 200 with a token and the topics already answered today', async () => {
      const first = await newChild();
      expect((await answerEssen(first.token)).status).toBe(201);
      const res = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: fox });
      expect(res.status).toBe(200);
      const session = bodyOf<KioskSession>(res);
      expect(session.token).not.toBe(first.token);
      expect(session.doneTopicIds).toEqual([f.essen.id]);
    });

    it('returns 404 unknown_code for an unknown or deactivated code', async () => {
      const unknown = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: fox });
      expect(unknown.status).toBe(404);
      expect(errorOf(unknown)).toBe('unknown_code');
      await newChild();
      const id = (t.db.prepare('SELECT id FROM child_code').get() as { id: number }).id;
      updateCode(t.db, id, { active: false });
      const inactive = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: fox });
      expect(inactive.status).toBe(404);
    });

    it('returns 429 after 20 failed attempts from one device within 10 minutes', async () => {
      await newChild();
      for (let i = 0; i < 20; i++) {
        const res = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: { ...fox, color: 'rot' } });
        expect(res.status).toBe(404);
      }
      const blocked = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: fox });
      expect(blocked.status).toBe(429);
      expect(errorOf(blocked)).toBe('too_many_attempts');
      t.setNow('2026-11-05T10:11:00Z');
      expect((await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: fox })).status).toBe(200);
    });
  });

  describe('POST /api/v1/kiosk/submissions', () => {
    it('stores the answers and returns 201 with the topic in doneTopicIds', async () => {
      const session = await newChild();
      const res = await answerEssen(session.token);
      expect(res.status).toBe(201);
      expect(bodyOf<{ doneTopicIds: number[] }>(res).doneTopicIds).toEqual([f.essen.id]);
      const sub = t.db.prepare('SELECT day, extended FROM submission').get();
      expect(sub).toEqual({ day: '2026-11-05', extended: 0 });
      const answers = t.db.prepare('SELECT question_id, value, option_id FROM answer ORDER BY id').all();
      expect(answers).toEqual([
        { question_id: f.taste.id, value: 4, option_id: null },
        { question_id: f.likes.id, value: null, option_id: f.pasta.id },
        { question_id: f.likes.id, value: null, option_id: f.pizza.id },
      ]);
    });

    it('returns 409 already_answered for a second submission of the same topic on the same day', async () => {
      const session = await newChild();
      await answerEssen(session.token);
      const again = await answerEssen(session.token);
      expect(again.status).toBe(409);
      expect(errorOf(again)).toBe('already_answered');
      expect(t.db.prepare('SELECT COUNT(*) AS n FROM answer').get()).toEqual({ n: 3 });
    });

    it('accepts the same topic again on the next Berlin day', async () => {
      const session = await newChild();
      await answerEssen(session.token);
      t.setNow('2026-11-05T23:05:00Z'); // 00:05 on 6 Nov in Berlin — a new day, so a new session
      const login = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: fox });
      expect(bodyOf<KioskSession>(login).doneTopicIds).toEqual([]);
      const res = await answerEssen(bodyOf<KioskSession>(login).token);
      expect(res.status).toBe(201);
      expect(t.db.prepare('SELECT day FROM submission ORDER BY id').all()).toEqual([{ day: '2026-11-05' }, { day: '2026-11-06' }]);
    });

    it('returns 401 session_expired without or with an unknown bearer token', async () => {
      const none = await t.call('/api/v1/kiosk/submissions', { cookie: tablet.cookie, json: { topicId: f.essen.id, answers: [] } });
      expect(none.status).toBe(401);
      expect(errorOf(none)).toBe('session_expired');
      const bogus = await answerEssen('not-a-token');
      expect(bogus.status).toBe(401);
      const session = await newChild();
      t.setNow('2026-11-05T10:21:00Z');
      expect((await answerEssen(session.token)).status).toBe(401);
    });

    it('returns 400 validation for an invalid answer', async () => {
      const session = await newChild();
      const res = await t.call('/api/v1/kiosk/submissions', {
        cookie: tablet.cookie,
        bearer: session.token,
        json: { topicId: f.essen.id, answers: [{ questionId: f.taste.id, value: 9 }] },
      });
      expect(res.status).toBe(400);
      expect(errorOf(res)).toBe('validation');
      const wrongTopic = await t.call('/api/v1/kiosk/submissions', {
        cookie: tablet.cookie,
        bearer: session.token,
        json: { topicId: f.hausaufgaben.id, answers: [{ questionId: f.taste.id, value: 3 }] },
      });
      expect(wrongTopic.status).toBe(400);
      expect(t.db.prepare('SELECT COUNT(*) AS n FROM submission').get()).toEqual({ n: 0 });
    });

    it('returns 403 csrf without the X-Wieisses header', async () => {
      const session = await newChild();
      const res = await t.call('/api/v1/kiosk/submissions', {
        cookie: tablet.cookie,
        bearer: session.token,
        csrf: false,
        json: { topicId: f.essen.id, answers: [{ questionId: f.taste.id, value: 4 }] },
      });
      expect(res.status).toBe(403);
      expect(errorOf(res)).toBe('csrf');
    });
  });
});
