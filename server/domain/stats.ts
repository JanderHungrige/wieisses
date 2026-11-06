// Aggregates for the admin dashboard (doc 01, "Statistics"). Pure functions over rows the
// results adapter loads; no SQL here, so every number on the dashboard is unit-tested.
import { FACES, SCALE_MAX, isScale, type QuestionKind, type ScaleKind } from '../../shared/catalog.ts';
import type { Bucket, Distribution } from '../../shared/schema.ts';
import { bucketKey } from './day.ts';

/** A scale answer on 0..100 (worst..best); null for anything that is not a scale. */
export function normalise(kind: QuestionKind, value: number | null): number | null {
  if (value === null || !isScale(kind)) return null;
  return ((value - 1) / (SCALE_MAX[kind] - 1)) * 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Mean normalised score of the scale answers among `rows`, or null when there are none. */
export function topicIndex(rows: readonly { kind: QuestionKind; value: number | null }[]): number | null {
  const scores = rows
    .map((row) => normalise(row.kind, row.value))
    .filter((score): score is number => score !== null);
  if (scores.length === 0) return null;
  return round1(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

/** Every possible answer of a built-in kind, best first, with zero counts kept. */
export function scaleDistribution(kind: ScaleKind, values: readonly number[]): Distribution {
  const entries = FACES[kind].map((face) => ({
    key: face.value,
    label: face.label,
    icon: face.emoji,
    count: values.filter((value) => value === face.value).length,
  }));
  const mean = isScale(kind) && values.length > 0 ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
  return { n: values.length, mean, entries };
}

/** Picks per option; n counts respondents, so shares of a multi choice can add up past 100 %. */
export function choiceDistribution(
  options: readonly { id: number; label: string; icon: string }[],
  rows: readonly { submissionId: number; optionId: number }[],
): Distribution {
  const entries = options.map((option) => ({
    key: option.id,
    label: option.label,
    icon: option.icon,
    count: rows.filter((row) => row.optionId === option.id).length,
  }));
  return { n: new Set(rows.map((row) => row.submissionId)).size, mean: null, entries };
}

/** Groups day-stamped rows into buckets, oldest first. Buckets without rows are absent. */
export function series<T extends { day: string }, S>(
  rows: readonly T[],
  bucket: Bucket,
  summarise: (rows: T[]) => S,
): ({ bucket: string } & S)[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = bucketKey(row.day, bucket);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.keys()].sort().map((key) => ({ bucket: key, ...summarise(groups.get(key) ?? []) }));
}
