// Removable demo answers (doc 04, "Demo data"): eight weeks on a revoked "Beispieldaten" tablet
// with inactive signs, visible on the dashboard, and removed again without touching real data.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { KioskSession, ResultsSummary } from '../../shared/schema.ts';
import { listCodes, listDevices } from '../../server/adapters/access-store.ts';
import { patchOption, patchQuestion } from '../../server/adapters/content-write.ts';
import { saveSettings, getSettings } from '../../server/adapters/settings-store.ts';
import { addDays, isoWeekday } from '../../server/domain/day.ts';
import { addDemo, demoStatus, removeDemo } from '../../server/handlers/demo.ts';
import { bodyOf, errorOf, fixture, startTestApp, type TestApp } from './harness.ts';

const TODAY = '2026-11-05'; // THURSDAY in the harness
let t: TestApp;
let f: ReturnType<typeof fixture>;

beforeEach(async () => {
  t = await startTestApp();
  f = fixture(t.db);
});
afterEach(() => t.close());

const deps = () => ({ db: t.db, now: t.app.now });
const count = (sql: string) => Number((t.db.prepare(sql).get() as { n: number }).n);
const days = () => (t.db.prepare('SELECT DISTINCT day FROM submission ORDER BY day').all() as { day: string }[]).map((r) => r.day);

/** A real child on a real tablet, with one answer today. */
async function realChild(): Promise<{ cookie: string; token: string }> {
  const tablet = t.device();
  const fox = { animal: 'fuchs', color: 'blau', fruit: 'apfel' };
  expect((await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { ...fox, grade: 2 } })).status).toBe(201);
  const login = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: fox });
  const { token } = bodyOf<KioskSession>(login);
  const res = await t.call('/api/v1/kiosk/submissions', { cookie: tablet.cookie, bearer: token, json: { topicId: f.hausaufgaben.id, answers: [{ questionId: f.quiet.id, value: 3 }] } });
  expect(res.status).toBe(201);
  return { cookie: tablet.cookie, token };
}

describe('addDemo', () => {
  it('fills eight weeks of school days up to yesterday and says so', () => {
    const summary = addDemo(deps(), {});
    expect(summary).toEqual({ codes: 45, submissions: count('SELECT COUNT(*) AS n FROM submission'), from: days()[0], to: days().at(-1) });
    expect(summary !== 'exists' && summary.submissions).toBeGreaterThan(300);
    expect(days()[0]! >= addDays(TODAY, -56)).toBe(true);
    expect(days().at(-1)).toBe(addDays(TODAY, -1));
    expect(days().every((day) => isoWeekday(day) <= 5)).toBe(true);
  });

  it('puts every demo sign, inactive, on one revoked "Beispieldaten" tablet', () => {
    addDemo(deps(), {});
    const [device] = listDevices(t.db).filter((d) => d.label === 'Beispieldaten');
    expect(device?.revoked).toBe(true);
    const codes = listCodes(t.db, {});
    expect(codes).toHaveLength(45);
    expect(codes.every((c) => !c.active && c.deviceLabel === 'Beispieldaten')).toBe(true);
    expect(new Set(codes.map((c) => c.createdAt.slice(0, 10))).size).toBeGreaterThan(5);
  });

  it('never lets a child log in with a demo sign', async () => {
    addDemo(deps(), {});
    const [code] = listCodes(t.db, {});
    const tablet = t.device();
    const res = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: { animal: code?.animal, color: code?.color, fruit: code?.fruit } });
    expect(res.status).toBe(404);
    expect(errorOf(res)).toBe('unknown_code');
  });

  it('answers only active questions and options, extended ones only on the extended weekdays', () => {
    patchQuestion(t.db, f.taste.id, { active: false });
    patchOption(t.db, f.pizza.id, { active: false });
    saveSettings(t.db, { ...getSettings(t.db), extendedWeekdays: [3] });
    addDemo(deps(), {});
    expect(count(`SELECT COUNT(*) AS n FROM answer WHERE question_id = ${f.taste.id}`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM answer WHERE option_id = ${f.pizza.id}`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM answer WHERE option_id = ${f.pasta.id}`)).toBeGreaterThan(0);
    const extendedDays = (t.db.prepare(`SELECT DISTINCT s.day FROM answer a JOIN submission s ON s.id = a.submission_id WHERE a.question_id = ${f.enough.id}`).all() as { day: string }[]).map((r) => r.day);
    expect(extendedDays.length).toBeGreaterThan(0);
    expect(extendedDays.every((day) => isoWeekday(day) === 3)).toBe(true);
  });

  it('refuses a second set', () => {
    addDemo(deps(), {});
    expect(addDemo(deps(), {})).toBe('exists');
    expect(listCodes(t.db, {})).toHaveLength(45);
  });

  it('shows on the dashboard', async () => {
    addDemo(deps(), {});
    const admin = await t.adminCookie();
    const res = await t.call(`/api/v1/admin/results/summary?from=${addDays(TODAY, -30)}&to=${TODAY}`, { cookie: admin });
    const summary = bodyOf<ResultsSummary>(res);
    expect(res.status).toBe(200);
    expect(summary.totals.submissions).toBeGreaterThan(100);
    expect(summary.totals.children).toBeGreaterThan(20);
  });
});

describe('removeDemo', () => {
  it('removes exactly the demo set and frees its signs', async () => {
    const real = await realChild();
    const summary = addDemo(deps(), {});
    const removed = removeDemo(t.db);
    expect(removed).toEqual({ codes: 45, submissions: summary !== 'exists' ? summary.submissions : -1, answers: expect.any(Number) });
    expect(listCodes(t.db, {}).map((c) => c.animal)).toEqual(['fuchs']);
    expect(count('SELECT COUNT(*) AS n FROM submission')).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM answer')).toBe(1);
    expect(listDevices(t.db).some((d) => d.label === 'Beispieldaten')).toBe(false);
    expect(count("SELECT COUNT(*) AS n FROM setting WHERE key = 'demo.deviceId'")).toBe(0);
    const done = await t.call('/api/v1/kiosk/session', { cookie: real.cookie, json: { animal: 'fuchs', color: 'blau', fruit: 'apfel' } });
    expect(bodyOf<KioskSession>(done).doneTopicIds).toEqual([f.hausaufgaben.id]);
  });

  it('says when there is nothing to remove', () => {
    expect(removeDemo(t.db)).toBe('none');
  });

  it('allows a new set after removing the old one', () => {
    addDemo(deps(), {});
    removeDemo(t.db);
    expect(addDemo(deps(), { seed: 7 })).not.toBe('exists');
  });
});

describe('demoStatus', () => {
  it('is null without a set and the counts with one', () => {
    expect(demoStatus(t.db)).toBeNull();
    const summary = addDemo(deps(), {});
    expect(demoStatus(t.db)).toEqual(summary);
  });
});
