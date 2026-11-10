// Plausible demo answers for showing the dashboard (doc 04, "Demo data"). Pure and seeded: the
// same seed gives the same codes and answers. Each topic has its own level and a slow drift over
// the weeks, so the index lines differ and move.
import { ANIMAL_IDS, COLOUR_IDS, FRUIT_IDS, type CodePicks, type QuestionKind } from '../../shared/catalog.ts';
import type { AnswerRow } from './answers.ts';
import { addDays, isExtendedDay, isoWeekday } from './day.ts';

export type DemoQuestion = { id: number; kind: QuestionKind; multi: boolean; frequency: 'core' | 'extended'; optionIds: number[] };
export type DemoTopic = { id: number; questions: DemoQuestion[] };
export type DemoCode = { grade: number; firstDay: string };
export type DemoSubmission = { code: number; topicId: number; day: string; extended: boolean; createdAt: string; rows: AnswerRow[] };

const TAKE_PART = 0.35;

/** A small linear congruential generator: numbers in [0, 1), the same for the same seed. */
export function seeded(seed: number): () => number {
  let state = seed % 2 ** 31;
  return () => (state = (state * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
}

const pick = <T>(list: readonly T[], rand: () => number): T => list[Math.floor(rand() * list.length)] as T;

/** Monday to Friday from `weeks` weeks before `today` up to yesterday. */
export function schoolDays(today: string, weeks: number): string[] {
  const days: string[] = [];
  for (let back = weeks * 7; back >= 1; back--) {
    const day = addDays(today, -back);
    if (isoWeekday(day) <= 5) days.push(day);
  }
  return days;
}

/** Every picture combination once, shuffled (Fisher–Yates). */
export function shuffledPicks(rand: () => number): CodePicks[] {
  const all = ANIMAL_IDS.flatMap((animal) => COLOUR_IDS.flatMap((color) => FRUIT_IDS.map((fruit) => ({ animal, color, fruit }))));
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j] as CodePicks, all[i] as CodePicks];
  }
  return all;
}

/** Two thirds of the codes start in the first week, the rest spread over the remaining days. */
export function demoCodes(days: readonly string[], count: number, grades: readonly number[], rand: () => number): DemoCode[] {
  const early = Math.round((count * 2) / 3);
  const later = days.slice(5);
  return Array.from({ length: count }, (_, i) => {
    const firstDay = i < early ? pick(days.slice(0, 5), rand) : (later[Math.floor(((i - early) / (count - early)) * later.length)] ?? days[0]);
    return { grade: grades[i % grades.length] ?? 1, firstDay: firstDay ?? '' };
  });
}

/** Chance of a good answer: the topic's own level plus a slow drift over the days. */
function goodChance(topicId: number, dayIndex: number): number {
  const level = 0.5 + ((topicId * 3) % 5) * 0.08; // topics 1–4: 0.74, 0.58, 0.82, 0.66
  return Math.min(0.95, level + 0.15 * Math.sin(dayIndex / 7 + topicId * 2));
}

function answer(q: DemoQuestion, good: boolean, rand: () => number): AnswerRow[] {
  const row = (value: number): AnswerRow[] => [{ questionId: q.id, value, optionId: null }];
  switch (q.kind) {
    case 'scale5':
      return row(good ? pick([4, 5, 5], rand) : pick([1, 2, 3, 3], rand));
    case 'scale3':
      return row(good ? pick([2, 3, 3], rand) : pick([1, 2], rand));
    case 'yesno':
      return row(good ? 1 : pick([0, 0, 1], rand));
    case 'choice': {
      const first = pick(q.optionIds, rand);
      const second = q.multi && rand() < 0.5 ? pick(q.optionIds, rand) : first;
      return [...new Set([first, second])].map((optionId) => ({ questionId: q.id, value: null, optionId }));
    }
    default:
      throw new Error(`unhandled kind: ${q.kind satisfies never}`);
  }
}

/** About a third of the code × topic × day slots get an answer, from each code's first day on. */
export function demoSubmissions(input: {
  days: readonly string[];
  codes: readonly DemoCode[];
  topics: readonly DemoTopic[];
  extendedWeekdays: readonly number[];
  rand: () => number;
}): DemoSubmission[] {
  const { rand } = input;
  return input.days.flatMap((day, dayIndex) => {
    const extended = isExtendedDay(day, input.extendedWeekdays);
    return input.topics.flatMap((topic) => {
      const asked = topic.questions.filter((q) => (q.frequency === 'core' || extended) && (q.kind !== 'choice' || q.optionIds.length > 0));
      if (asked.length === 0) return [];
      return input.codes.flatMap((code, index): DemoSubmission[] => {
        if (day < code.firstDay || rand() > TAKE_PART) return [];
        const rows = asked.flatMap((q) => answer(q, rand() < goodChance(topic.id, dayIndex), rand));
        const minute = 30 + Math.floor(rand() * 150); // 12:30–15:00 Berlin, as UTC in winter
        const createdAt = `${day}T${String(11 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00Z`;
        return [{ code: index, topicId: topic.id, day, extended, createdAt, rows }];
      });
    });
  });
}
