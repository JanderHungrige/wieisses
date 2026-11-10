// Removable demo answers for showing the dashboard (doc 04, "Demo data"): eight weeks of answers
// from 45 inactive signs on a revoked "Beispieldaten" tablet, for the active content only.
import type { CountedTopic } from '../../shared/schema.ts';
import { createCode, registerDevice, updateCode, updateDevice } from '../adapters/access-store.ts';
import { adminTopics } from '../adapters/content-store.ts';
import { transaction, type Db } from '../adapters/db.ts';
import { deleteDemo, demoCounts, demoDeviceId, markDemoDevice } from '../adapters/demo-store.ts';
import { getSettings } from '../adapters/settings-store.ts';
import { insertSubmission } from '../adapters/submission-store.ts';
import { berlinDay } from '../domain/day.ts';
import { demoCodes, demoSubmissions, schoolDays, seeded, shuffledPicks, type DemoCode, type DemoTopic } from '../domain/demo-answers.ts';
import type { ContentDeps } from './content.ts';

export type DemoSummary = { codes: number; submissions: number; from: string | null; to: string | null };

const LABEL = 'Beispieldaten';
const CODE_COUNT = 45;
const WEEKS = 8;

function demoTopics(topics: readonly CountedTopic[]): DemoTopic[] {
  return topics
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id,
      questions: t.questions
        .filter((q) => q.active)
        .map((q) => ({ id: q.id, kind: q.kind, multi: q.multi, frequency: q.frequency, optionIds: q.options.filter((o) => o.active).map((o) => o.id) })),
    }));
}

/** Creates the codes on free picture combinations, inactive from the start; returns their ids. */
function createDemoCodes(db: Db, codes: readonly DemoCode[], deviceId: number, rand: () => number): number[] {
  const picks = shuffledPicks(rand);
  return codes.map((code) => {
    for (let pick = picks.shift(); pick; pick = picks.shift()) {
      const id = createCode(db, { ...pick, grade: code.grade, deviceId, createdAt: `${code.firstDay}T11:00:00Z` });
      if (id === 'taken') continue;
      updateCode(db, id, { active: false });
      return id;
    }
    throw new Error('no free picture combination left for the demo codes');
  });
}

export function demoStatus(db: Db): DemoSummary | null {
  const deviceId = demoDeviceId(db);
  if (deviceId === null) return null;
  const { codes, submissions, from, to } = demoCounts(db, deviceId);
  return { codes, submissions, from, to };
}

export function addDemo(deps: ContentDeps, options: { seed?: number }): DemoSummary | 'exists' {
  if (demoDeviceId(deps.db) !== null) return 'exists';
  const now = deps.now();
  const rand = seeded(options.seed ?? 42);
  const settings = getSettings(deps.db);
  const days = schoolDays(berlinDay(now), WEEKS);
  const codes = demoCodes(days, CODE_COUNT, settings.grades, rand);
  const topics = demoTopics(adminTopics(deps.db));
  const submissions = demoSubmissions({ days, codes, topics, extendedWeekdays: settings.extendedWeekdays, rand });
  transaction(deps.db, () => {
    const { device } = registerDevice(deps.db, LABEL, now); // its token is never handed out
    updateDevice(deps.db, device.id, { revoked: true });
    markDemoDevice(deps.db, device.id);
    const ids = createDemoCodes(deps.db, codes, device.id, rand);
    for (const s of submissions) {
      const codeId = ids[s.code] ?? 0;
      insertSubmission(deps.db, { codeId, topicId: s.topicId, day: s.day, extended: s.extended, createdAt: s.createdAt, rows: s.rows });
    }
  });
  const summary = demoStatus(deps.db);
  if (!summary) throw new Error('the demo set was not written');
  return summary;
}

export function removeDemo(db: Db): { codes: number; submissions: number; answers: number } | 'none' {
  const deviceId = demoDeviceId(db);
  if (deviceId === null) return 'none';
  const { codes, submissions, answers } = demoCounts(db, deviceId);
  deleteDemo(db, deviceId);
  return { codes, submissions, answers };
}
