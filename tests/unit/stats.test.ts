import { describe, it, expect } from 'vitest';
import { choiceDistribution, normalise, scaleDistribution, series, topicIndex } from '../../server/domain/stats.ts';

describe('Statistics (server/domain/stats.ts)', () => {
  describe('normalise', () => {
    it('maps scale5 1..5 and scale3 1..3 onto 0..100', () => {
      expect([1, 2, 3, 4, 5].map((v) => normalise('scale5', v))).toEqual([0, 25, 50, 75, 100]);
      expect([1, 2, 3].map((v) => normalise('scale3', v))).toEqual([0, 50, 100]);
      expect(normalise('yesno', 1)).toBeNull();
      expect(normalise('scale5', null)).toBeNull();
    });
  });

  describe('topicIndex', () => {
    it('is the mean normalised score of scale answers only', () => {
      const rows = [
        { kind: 'scale5' as const, value: 5 },
        { kind: 'scale3' as const, value: 2 },
        { kind: 'yesno' as const, value: 0 },
        { kind: 'choice' as const, value: null },
      ];
      expect(topicIndex(rows)).toBe(75);
      expect(topicIndex([{ kind: 'scale5', value: 4 }, { kind: 'scale5', value: 4 }, { kind: 'scale5', value: 5 }])).toBe(83.3);
    });

    it('is null when there are no scale answers', () => {
      expect(topicIndex([])).toBeNull();
      expect(topicIndex([{ kind: 'yesno', value: 1 }])).toBeNull();
    });
  });

  describe('distribution', () => {
    it('counts every possible value of a scale question, including zero counts, with labels', () => {
      const d = scaleDistribution('scale5', [5, 5, 4, 1]);
      expect(d.n).toBe(4);
      expect(d.mean).toBe(3.8);
      expect(d.entries.map((e) => [e.key, e.count])).toEqual([[5, 2], [4, 1], [3, 0], [2, 0], [1, 1]]);
      expect(d.entries[0]).toMatchObject({ label: 'Super', icon: '😄' });
      const yes = scaleDistribution('yesno', [1, 1, 0]);
      expect(yes.mean).toBeNull();
      expect(yes.entries.map((e) => [e.label, e.count])).toEqual([['Ja', 2], ['Nein', 1]]);
    });

    it('counts choice options per option and reports n as the number of respondents', () => {
      const options = [
        { id: 1, label: 'Basteln', icon: '✂️' },
        { id: 2, label: 'Lesen', icon: '📖' },
        { id: 3, label: 'Musik', icon: '🎵' },
      ];
      const d = choiceDistribution(options, [
        { submissionId: 10, optionId: 1 },
        { submissionId: 10, optionId: 2 },
        { submissionId: 11, optionId: 1 },
      ]);
      expect(d.n).toBe(2);
      expect(d.mean).toBeNull();
      expect(d.entries.map((e) => [e.label, e.count])).toEqual([['Basteln', 2], ['Lesen', 1], ['Musik', 0]]);
    });
  });

  describe('series', () => {
    it('groups rows into day/week/month buckets in order, without gaps filled by fake data', () => {
      const rows = [
        { day: '2026-11-06', v: 1 },
        { day: '2026-10-20', v: 2 },
        { day: '2026-11-02', v: 3 },
        { day: '2026-11-05', v: 4 },
      ];
      const weekly = series(rows, 'week', (group) => ({ total: group.reduce((s, r) => s + r.v, 0) }));
      expect(weekly).toEqual([
        { bucket: '2026-10-19', total: 2 },
        { bucket: '2026-11-02', total: 8 },
      ]);
      expect(series(rows, 'month', (g) => ({ n: g.length }))).toEqual([
        { bucket: '2026-10-01', n: 1 },
        { bucket: '2026-11-01', n: 3 },
      ]);
      expect(series(rows, 'day', (g) => ({ n: g.length }))).toHaveLength(4);
      expect(series([], 'day', (g) => ({ n: g.length }))).toEqual([]);
    });
  });
});
