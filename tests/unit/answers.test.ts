import { describe, it, expect } from 'vitest';
import { validateSubmission, type QuestionForCheck } from '../../server/domain/answers.ts';

const q = (id: number, over: Partial<QuestionForCheck> = {}): QuestionForCheck => ({
  id,
  topicId: 1,
  kind: 'scale5',
  multi: false,
  frequency: 'core',
  active: true,
  options: [],
  ...over,
});

const questions: QuestionForCheck[] = [
  q(1, { kind: 'scale5' }),
  q(2, { kind: 'scale3' }),
  q(3, { kind: 'yesno' }),
  q(4, { kind: 'choice', options: [{ id: 41, active: true }, { id: 42, active: true }, { id: 43, active: false }] }),
  q(5, { kind: 'choice', multi: true, options: [{ id: 51, active: true }, { id: 52, active: true }] }),
  q(6, { kind: 'yesno', frequency: 'extended' }),
  q(7, { kind: 'yesno', active: false }),
  q(8, { kind: 'yesno', topicId: 2 }),
];

const ctx = { topicId: 1, questions, extendedToday: false };

function message(result: ReturnType<typeof validateSubmission>): string {
  return result.ok ? 'ok' : result.message;
}

describe('Submission validation (server/domain/answers.ts)', () => {
  describe('accepts', () => {
    it('a valid answer to each kind: scale5, scale3, yesno, single choice, multi choice', () => {
      const result = validateSubmission(
        [
          { questionId: 1, value: 5 },
          { questionId: 2, value: 1 },
          { questionId: 3, value: 0 },
          { questionId: 4, optionIds: [42] },
          { questionId: 5, optionIds: [51, 52] },
        ],
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rows).toHaveLength(6);
      expect(result.rows[0]).toEqual({ questionId: 1, value: 5, optionId: null });
      expect(result.rows.filter((row) => row.questionId === 5).map((row) => row.optionId)).toEqual([51, 52]);
    });

    it('a submission that skips some questions', () => {
      const result = validateSubmission([{ questionId: 3, value: 1 }], ctx);
      expect(result).toEqual({ ok: true, rows: [{ questionId: 3, value: 1, optionId: null }] });
    });

    it('an extended question on an extended day', () => {
      expect(validateSubmission([{ questionId: 6, value: 1 }], { ...ctx, extendedToday: true }).ok).toBe(true);
    });
  });

  describe('rejects', () => {
    it('an empty answer list', () => {
      expect(message(validateSubmission([], ctx))).toBe('Keine Antwort');
    });

    it('the same question twice', () => {
      const result = validateSubmission([{ questionId: 1, value: 5 }, { questionId: 1, value: 4 }], ctx);
      expect(result.ok).toBe(false);
      expect(message(result)).toContain('doppelt');
    });

    it('a question of another topic, an inactive question, or an extended question on a normal day', () => {
      expect(validateSubmission([{ questionId: 8, value: 1 }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 7, value: 1 }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 6, value: 1 }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 99, value: 1 }], ctx).ok).toBe(false);
    });

    it('a scale value out of range and a yesno value other than 0/1', () => {
      expect(validateSubmission([{ questionId: 1, value: 6 }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 1, value: 0 }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 2, value: 4 }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 3, value: 2 }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 3 }], ctx).ok).toBe(false);
    });

    it('optionIds on a scale question and a value on a choice question', () => {
      expect(validateSubmission([{ questionId: 1, value: 5, optionIds: [41] }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 4, value: 1, optionIds: [41] }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 4, optionIds: [] }], ctx).ok).toBe(false);
    });

    it('two options on a single choice, a foreign or inactive option, duplicate options', () => {
      expect(message(validateSubmission([{ questionId: 4, optionIds: [41, 42] }], ctx))).toContain('nur eine');
      expect(validateSubmission([{ questionId: 4, optionIds: [51] }], ctx).ok).toBe(false);
      expect(validateSubmission([{ questionId: 4, optionIds: [43] }], ctx).ok).toBe(false);
      expect(message(validateSubmission([{ questionId: 5, optionIds: [51, 51] }], ctx))).toContain('doppelt');
    });
  });
});
