// The demo answer generator (doc 04, "Demo data"): school days up to yesterday, codes that appear
// over time, at most one answer per code, topic and day, and only valid answers.
import { describe, expect, it } from 'vitest';
import { ANIMALS, COLOURS, FRUITS } from '../../shared/catalog.ts';
import { addDays, isExtendedDay, isoWeekday } from '../../server/domain/day.ts';
import { demoCodes, demoSubmissions, schoolDays, seeded, shuffledPicks, type DemoTopic } from '../../server/domain/demo-answers.ts';

const TODAY = '2026-11-10'; // a Tuesday
const days = schoolDays(TODAY, 8);

const TOPICS: DemoTopic[] = [
  {
    id: 1,
    questions: [
      { id: 10, kind: 'scale5', multi: false, frequency: 'core', optionIds: [] },
      { id: 11, kind: 'yesno', multi: false, frequency: 'core', optionIds: [] },
      { id: 12, kind: 'choice', multi: true, frequency: 'extended', optionIds: [100, 101, 102] },
    ],
  },
  {
    id: 2,
    questions: [
      { id: 20, kind: 'scale3', multi: false, frequency: 'core', optionIds: [] },
      { id: 21, kind: 'choice', multi: false, frequency: 'core', optionIds: [200, 201] },
    ],
  },
];

function generate(seed = 42) {
  const rand = seeded(seed);
  const codes = demoCodes(days, 45, [1, 2, 3, 4], rand);
  return { codes, submissions: demoSubmissions({ days, codes, topics: TOPICS, extendedWeekdays: [5], rand }) };
}

describe('seeded', () => {
  it('gives the same numbers in [0, 1) for the same seed', () => {
    const a = seeded(7);
    const b = seeded(7);
    const run = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(run);
    expect(run.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(run).size).toBeGreaterThan(45);
  });
});

describe('schoolDays', () => {
  it('lists Monday to Friday of the eight weeks before today, ending yesterday', () => {
    expect(days[0]).toBe(addDays(TODAY, -56));
    expect(days.at(-1)).toBe('2026-11-09');
    expect(days).toHaveLength(40);
    expect(days.every((day) => isoWeekday(day) <= 5)).toBe(true);
    expect(days).not.toContain(TODAY);
    expect([...days].sort()).toEqual(days);
  });
});

describe('shuffledPicks', () => {
  it('lists every picture combination once, in a seeded order', () => {
    const picks = shuffledPicks(seeded(1));
    expect(picks).toHaveLength(ANIMALS.length * COLOURS.length * FRUITS.length);
    expect(new Set(picks.map((p) => `${p.animal}/${p.color}/${p.fruit}`)).size).toBe(picks.length);
    expect(shuffledPicks(seeded(1))).toEqual(picks);
    expect(shuffledPicks(seeded(2))).not.toEqual(picks);
  });
});

describe('demoCodes', () => {
  const { codes } = generate();

  it('makes the asked number of codes with the allowed grades, first days among the school days', () => {
    expect(codes).toHaveLength(45);
    expect(codes.every((c) => [1, 2, 3, 4].includes(c.grade))).toBe(true);
    expect(codes.every((c) => days.includes(c.firstDay))).toBe(true);
    expect(new Set(codes.map((c) => c.grade)).size).toBe(4);
  });

  it('starts two thirds in the first week and lets the rest trickle in, some in the last 14 days', () => {
    const firstWeek = days.slice(0, 5);
    expect(codes.filter((c) => firstWeek.includes(c.firstDay))).toHaveLength(30);
    expect(codes.some((c) => c.firstDay >= addDays(TODAY, -14))).toBe(true);
  });
});

describe('demoSubmissions', () => {
  const { codes, submissions } = generate();

  it('answers each topic at most once per code and day, never before the code exists', () => {
    const keys = submissions.map((s) => `${s.code}/${s.topicId}/${s.day}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(submissions.every((s) => s.day >= (codes[s.code]?.firstDay ?? '9999'))).toBe(true);
    expect(submissions.every((s) => days.includes(s.day) && s.createdAt.startsWith(`${s.day}T`))).toBe(true);
  });

  it('takes part on about a third of the possible code, topic and day slots', () => {
    const slots = codes.reduce((n, c) => n + days.filter((d) => d >= c.firstDay).length, 0) * TOPICS.length;
    const share = submissions.length / slots;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.45);
  });

  it('asks the extended questions only on the extended weekdays, and every other question always', () => {
    for (const s of submissions) {
      expect(s.extended).toBe(isExtendedDay(s.day, [5]));
      const topic = TOPICS.find((t) => t.id === s.topicId);
      const asked = topic?.questions.filter((q) => q.frequency === 'core' || s.extended).map((q) => q.id);
      expect([...new Set(s.rows.map((r) => r.questionId))].sort()).toEqual(asked?.sort());
    }
  });

  it('gives only valid values and options', () => {
    const rows = submissions.flatMap((s) => s.rows);
    const valueOf = (id: number) => rows.filter((r) => r.questionId === id).map((r) => r.value);
    expect(valueOf(10).every((v) => v !== null && v >= 1 && v <= 5)).toBe(true);
    expect(valueOf(20).every((v) => v !== null && v >= 1 && v <= 3)).toBe(true);
    expect(valueOf(11).every((v) => v === 0 || v === 1)).toBe(true);
    expect(rows.filter((r) => r.questionId === 21).every((r) => r.value === null && (r.optionId === 200 || r.optionId === 201))).toBe(true);
    for (const s of submissions) {
      if (s.topicId === 2) expect(s.rows.filter((r) => r.questionId === 21)).toHaveLength(1);
      const multi = s.rows.filter((r) => r.questionId === 12).map((r) => r.optionId);
      if (s.topicId === 1 && s.extended) expect(multi.length === 1 || multi.length === 2).toBe(true);
      expect(new Set(multi).size).toBe(multi.length);
      expect(multi.every((o) => o === 100 || o === 101 || o === 102)).toBe(true);
    }
  });

  it('leans good, with a different level per topic', () => {
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const scale5 = submissions.flatMap((s) => s.rows).filter((r) => r.questionId === 10).map((r) => r.value ?? 0);
    const norm5 = (mean(scale5) - 1) / 4;
    const scale3 = submissions.flatMap((s) => s.rows).filter((r) => r.questionId === 20).map((r) => r.value ?? 0);
    const norm3 = (mean(scale3) - 1) / 2;
    expect(norm5).toBeGreaterThan(0.5);
    expect(norm3).toBeGreaterThan(0.5);
    expect(Math.abs(norm5 - norm3)).toBeGreaterThan(0.03);
  });

  it('is the same for the same seed and different for another', () => {
    expect(generate(42)).toEqual(generate(42));
    expect(generate(43).submissions).not.toEqual(generate(42).submissions);
  });
});
