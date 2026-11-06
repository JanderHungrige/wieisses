// Dates and numbers as a German school office reads them.
import type { Bucket } from '../../shared/schema.ts';

const berlin = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DAY_MS = 86_400_000;

export const todayBerlin = (): string => berlin.format(new Date());

export function addDays(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** 1 August of the current school year. */
export function schoolYearStart(today: string): string {
  const year = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 8 ? `${year}-08-01` : `${year - 1}-08-01`;
}

export function isoWeek(day: string): number {
  const date = new Date(`${day}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

export function shortDate(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
}

export function longDate(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
}

export function bucketLabel(bucket: string, kind: Bucket): string {
  switch (kind) {
    case 'day':
      return shortDate(bucket);
    case 'week':
      return `KW ${isoWeek(bucket)}`;
    case 'month':
      return `${MONTHS[Number(bucket.slice(5, 7)) - 1]} ${bucket.slice(0, 4)}`;
    default:
      throw new Error(`unhandled bucket: ${kind satisfies never}`);
  }
}

export function dateTime(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
}

export const percent = (part: number, whole: number): string => (whole === 0 ? '–' : `${Math.round((part / whole) * 100)} %`);
export const indexText = (index: number | null): string => (index === null ? '–' : String(Math.round(index)));
