import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { AnswerInput, QuestionResults, ResultsSummary } from '../../shared/schema.ts';
import { bodyOf, fixture, startTestApp, type TestApp } from './harness.ts';

// A (grade 1) and B (grade 3) answer on three days; the range is 1–7 Nov 2026, so 29 Oct falls
// into the previous range (25–31 Oct).
let t: TestApp;
let f: ReturnType<typeof fixture>;
let admin: string;
const A = { animal: 'fuchs', color: 'blau', fruit: 'apfel' };
const B = { animal: 'eule', color: 'lila', fruit: 'birne' };
const RANGE = 'from=2026-11-01&to=2026-11-07';

async function as(picks: typeof A, day: string, topicId: number, answers: AnswerInput[]): Promise<void> {
  t.setNow(`${day}T10:00:00Z`);
  const tablet = t.device();
  const login = await t.call('/api/v1/kiosk/session', { cookie: tablet.cookie, json: picks });
  const { token } = bodyOf<{ token: string }>(login);
  const res = await t.call('/api/v1/kiosk/submissions', { cookie: tablet.cookie, bearer: token, json: { topicId, answers } });
  expect(res.status).toBe(201);
}

beforeAll(async () => {
  t = await startTestApp({ now: '2026-10-28T10:00:00Z' });
  f = fixture(t.db);
  const tablet = t.device();
  await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { ...A, grade: 1 } });
  await t.call('/api/v1/kiosk/codes', { cookie: tablet.cookie, json: { ...B, grade: 3 } });
  await as(B, '2026-10-29', f.essen.id, [{ questionId: f.taste.id, value: 1 }]);
  await as(A, '2026-11-04', f.essen.id, [{ questionId: f.taste.id, value: 4 }]);
  await as(A, '2026-11-05', f.essen.id, [{ questionId: f.taste.id, value: 5 }, { questionId: f.likes.id, optionIds: [f.pasta.id, f.pizza.id] }]);
  await as(B, '2026-11-05', f.essen.id, [{ questionId: f.taste.id, value: 3 }, { questionId: f.likes.id, optionIds: [f.pasta.id] }]);
  await as(A, '2026-11-05', f.hausaufgaben.id, [{ questionId: f.quiet.id, value: 3 }]);
  admin = await t.adminCookie();
});
afterAll(() => t.close());
afterEach(() => undefined);

async function summary(query: string): Promise<ResultsSummary> {
  const res = await t.call(`/api/v1/admin/results/summary?${query}`, { cookie: admin });
  expect(res.status).toBe(200);
  return bodyOf<ResultsSummary>(res);
}

describe('Results API', () => {
  describe('GET /api/v1/admin/results/summary', () => {
    it('reports submissions, distinct children and index per topic for the range', async () => {
      const s = await summary(RANGE);
      expect(s.totals).toEqual({ submissions: 4, children: 2, previous: { submissions: 1, children: 1 } });
      const essen = s.topics.find((x) => x.topicId === f.essen.id);
      expect(essen).toMatchObject({ name: 'Essen', color: '#f7a541', submissions: 3, children: 2, index: 75 });
      const ha = s.topics.find((x) => x.topicId === f.hausaufgaben.id);
      expect(ha).toMatchObject({ submissions: 1, children: 1, index: 100 });
    });

    it('reports the previous range of equal length for comparison', async () => {
      const s = await summary(RANGE);
      expect(s.previous).toEqual({ from: '2026-10-25', to: '2026-10-31' });
      expect(s.topics.find((x) => x.topicId === f.essen.id)?.previous).toEqual({ submissions: 1, children: 1, index: 0 });
      expect(s.topics.find((x) => x.topicId === f.hausaufgaben.id)?.previous).toEqual({ submissions: 0, children: 0, index: null });
    });

    it('filters by grade', async () => {
      const s = await summary(`${RANGE}&grade=3`);
      expect(s.grade).toBe(3);
      expect(s.totals.submissions).toBe(1);
      expect(s.topics.find((x) => x.topicId === f.essen.id)).toMatchObject({ submissions: 1, children: 1, index: 50 });
      expect(s.topics.find((x) => x.topicId === f.hausaufgaben.id)).toMatchObject({ submissions: 0, index: null });
    });

    it('returns a series per bucket', async () => {
      const weekly = await summary(RANGE);
      expect(weekly.bucket).toBe('week');
      expect(weekly.topics.find((x) => x.topicId === f.essen.id)?.series).toEqual([{ bucket: '2026-11-02', submissions: 3, index: 75 }]);
      const daily = await summary(`${RANGE}&bucket=day`);
      expect(daily.topics.find((x) => x.topicId === f.essen.id)?.series).toEqual([
        { bucket: '2026-11-04', submissions: 1, index: 75 },
        { bucket: '2026-11-05', submissions: 2, index: 75 },
      ]);
      const bad = await t.call('/api/v1/admin/results/summary?from=2026-11-07&to=2026-11-01', { cookie: admin });
      expect(bad.status).toBe(400);
    });
  });

  describe('GET /api/v1/admin/results/questions/:id', () => {
    it('returns the distribution with labels and the mean for a scale question', async () => {
      const res = await t.call(`/api/v1/admin/results/questions/${f.taste.id}?${RANGE}&bucket=day`, { cookie: admin });
      const r = bodyOf<QuestionResults>(res);
      expect(r.question).toMatchObject({ id: f.taste.id, kind: 'scale5', text: 'Wie hat es geschmeckt?' });
      expect(r.n).toBe(3);
      expect(r.mean).toBe(4);
      expect(r.entries.map((e) => [e.label, e.count])).toEqual([['Super', 1], ['Gut', 1], ['Geht so', 1], ['Nicht so gut', 0], ['Schlecht', 0]]);
      expect(r.series.map((b) => [b.bucket, b.n])).toEqual([['2026-11-04', 1], ['2026-11-05', 2]]);
    });

    it('returns option counts for a multi choice question', async () => {
      const r = bodyOf<QuestionResults>(await t.call(`/api/v1/admin/results/questions/${f.likes.id}?${RANGE}`, { cookie: admin }));
      expect(r.n).toBe(2);
      expect(r.mean).toBeNull();
      expect(r.entries.map((e) => [e.label, e.icon, e.count])).toEqual([['Nudeln', '🍝', 2], ['Pizza', '🍕', 1]]);
    });
  });

  describe('GET /api/v1/admin/results/export.csv', () => {
    it('returns semicolon-separated UTF-8 CSV with BOM and one row per answer', async () => {
      const res = await fetch(`${t.base}/api/v1/admin/results/export.csv?${RANGE}`, { headers: { Cookie: admin } });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(res.headers.get('content-disposition')).toContain('wieisses-2026-11-01-bis-2026-11-07.csv');
      const bytes = Buffer.from(await res.arrayBuffer());
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const lines = bytes.toString('utf8').slice(1).trimEnd().split('\r\n');
      expect(lines[0]).toBe('Datum;Klasse;Thema;Frage;Art;Wert;Antwort;Ausführlich');
      expect(lines).toHaveLength(1 + 7);
      expect(lines).toContain('2026-11-05;1;Essen;Wie hat es geschmeckt?;scale5;5;Super;nein');
      expect(lines).toContain('2026-11-05;3;Essen;Was magst du?;choice;;Nudeln;nein');
    });

    it('never contains a code id or the code pictures', async () => {
      const text = await (await fetch(`${t.base}/api/v1/admin/results/export.csv?${RANGE}`, { headers: { Cookie: admin } })).text();
      for (const secret of ['fuchs', 'Fuchs', 'eule', 'Eule', 'blau', 'lila', 'apfel', 'birne']) expect(text).not.toContain(secret);
    });
  });

  it('requires the admin session', async () => {
    for (const path of [`/api/v1/admin/results/summary?${RANGE}`, `/api/v1/admin/results/questions/${f.taste.id}?${RANGE}`, `/api/v1/admin/results/export.csv?${RANGE}`]) {
      expect((await t.call(path)).status).toBe(401);
    }
  });
});
