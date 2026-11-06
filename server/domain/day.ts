// Calendar arithmetic on Berlin dates ('YYYY-MM-DD'). A school day ends at Berlin midnight,
// so "once per day" and the extended weekdays are decided here, never in UTC (doc 01).
import type { Bucket } from '../../shared/schema.ts';

const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_MS = 86_400_000;

/** The Berlin calendar date of an instant. */
export function berlinDay(at: Date): string {
  return berlinDate.format(at);
}

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return fromUtc(new Date(toUtc(day).getTime() + days * DAY_MS));
}

/** Inclusive number of days from `from` to `to`. */
export function dayCount(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS) + 1;
}

/** ISO weekday: Monday 1 … Sunday 7. */
export function isoWeekday(day: string): number {
  const weekday = toUtc(day).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function isExtendedDay(day: string, extendedWeekdays: readonly number[]): boolean {
  return extendedWeekdays.includes(isoWeekday(day));
}

/** First day of the bucket a day falls into: itself, the Monday of its ISO week, the 1st. */
export function bucketKey(day: string, bucket: Bucket): string {
  switch (bucket) {
    case 'day':
      return day;
    case 'week':
      return addDays(day, 1 - isoWeekday(day));
    case 'month':
      return `${day.slice(0, 7)}-01`;
    default:
      throw new Error(`unhandled bucket: ${bucket satisfies never}`);
  }
}

/** The range of equal length that ends the day before `from`. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const length = dayCount(from, to);
  const prevTo = addDays(from, -1);
  return { from: addDays(prevTo, 1 - length), to: prevTo };
}
