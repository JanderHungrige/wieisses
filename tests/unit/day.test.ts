import { describe, it, expect } from 'vitest';
import { berlinDay, bucketKey, isExtendedDay, isoWeekday, previousRange, addDays, dayCount } from '../../server/domain/day.ts';

describe('Berlin calendar (server/domain/day.ts)', () => {
  describe('berlinDay', () => {
    it('returns the Berlin date, not the UTC date, shortly after midnight Berlin time', () => {
      // 23:30 UTC on 5 Nov is 00:30 on 6 Nov in Berlin (CET, UTC+1).
      expect(berlinDay(new Date('2026-11-05T23:30:00Z'))).toBe('2026-11-06');
      expect(berlinDay(new Date('2026-11-05T22:59:00Z'))).toBe('2026-11-05');
      // Summer time (CEST, UTC+2): 22:30 UTC is already the next day.
      expect(berlinDay(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
    });

    it('handles the DST switch days (last Sunday of March and October)', () => {
      expect(berlinDay(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29');
      expect(berlinDay(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-29');
      expect(berlinDay(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25');
      expect(berlinDay(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
      expect(dayCount('2026-03-28', '2026-03-30')).toBe(3);
      expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    });
  });

  describe('isoWeekday / isExtendedDay', () => {
    it('maps Monday to 1 and Sunday to 7', () => {
      expect(isoWeekday('2026-11-02')).toBe(1);
      expect(isoWeekday('2026-11-06')).toBe(5);
      expect(isoWeekday('2026-11-08')).toBe(7);
    });

    it('is an extended day only when the weekday is in extendedWeekdays', () => {
      expect(isExtendedDay('2026-11-06', [5])).toBe(true);
      expect(isExtendedDay('2026-11-05', [5])).toBe(false);
      expect(isExtendedDay('2026-11-02', [1, 3])).toBe(true);
      expect(isExtendedDay('2026-11-06', [])).toBe(false);
    });
  });

  describe('bucketKey', () => {
    it('keeps the day for bucket=day, the Monday for bucket=week, the first of the month for bucket=month', () => {
      expect(bucketKey('2026-11-06', 'day')).toBe('2026-11-06');
      expect(bucketKey('2026-11-06', 'week')).toBe('2026-11-02');
      expect(bucketKey('2026-11-08', 'week')).toBe('2026-11-02');
      expect(bucketKey('2026-11-02', 'week')).toBe('2026-11-02');
      expect(bucketKey('2027-01-01', 'week')).toBe('2026-12-28');
      expect(bucketKey('2026-11-06', 'month')).toBe('2026-11-01');
    });
  });

  describe('previousRange', () => {
    it('returns the range of equal length that ends the day before from', () => {
      expect(previousRange('2026-11-01', '2026-11-30')).toEqual({ from: '2026-10-02', to: '2026-10-31' });
      expect(previousRange('2026-11-06', '2026-11-06')).toEqual({ from: '2026-11-05', to: '2026-11-05' });
      const prev = previousRange('2026-03-01', '2026-03-31');
      expect(dayCount(prev.from, prev.to)).toBe(31);
      expect(prev.to).toBe('2026-02-28');
    });
  });
});
