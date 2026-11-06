// Validates a child's submission for one topic against the questions shown today (doc 01,
// "Submission validation"). Pure: the handler loads the topic's questions and passes them in.
import { FACES, type QuestionKind } from '../../shared/catalog.ts';
import type { AnswerInput } from '../../shared/schema.ts';

export type QuestionForCheck = {
  id: number;
  topicId: number;
  kind: QuestionKind;
  multi: boolean;
  frequency: 'core' | 'extended';
  active: boolean;
  options: { id: number; active: boolean }[];
};

/** One `answer` row: a value for scale/yesno, one row per picked option for choice. */
export type AnswerRow = { questionId: number; value: number | null; optionId: number | null };

export type CheckResult = { ok: true; rows: AnswerRow[] } | { ok: false; message: string };

type Context = { topicId: number; questions: readonly QuestionForCheck[]; extendedToday: boolean };

export function validateSubmission(answers: readonly AnswerInput[], ctx: Context): CheckResult {
  if (answers.length === 0) return fail('Keine Antwort');
  const seen = new Set<number>();
  const rows: AnswerRow[] = [];
  for (const answer of answers) {
    if (seen.has(answer.questionId)) return fail(`Frage ${answer.questionId} doppelt`);
    seen.add(answer.questionId);
    const question = ctx.questions.find((q) => q.id === answer.questionId);
    if (!question || !shownToday(question, ctx)) return fail(`Frage ${answer.questionId} gehört heute nicht dazu`);
    const checked = checkAnswer(question, answer);
    if (!checked.ok) return checked;
    rows.push(...checked.rows);
  }
  return { ok: true, rows };
}

function shownToday(question: QuestionForCheck, ctx: Context): boolean {
  return (
    question.topicId === ctx.topicId &&
    question.active &&
    (question.frequency === 'core' || ctx.extendedToday)
  );
}

function checkAnswer(question: QuestionForCheck, answer: AnswerInput): CheckResult {
  switch (question.kind) {
    case 'scale5':
    case 'scale3':
    case 'yesno':
      return checkValue(question.kind, question.id, answer);
    case 'choice':
      return checkChoice(question, answer);
    default:
      throw new Error(`unhandled kind: ${question.kind satisfies never}`);
  }
}

function checkValue(kind: 'scale5' | 'scale3' | 'yesno', questionId: number, answer: AnswerInput): CheckResult {
  if (answer.optionIds !== undefined) return fail(`Frage ${questionId}: keine Auswahl erlaubt`);
  const allowed = FACES[kind].map((face) => face.value);
  if (answer.value === undefined || !allowed.includes(answer.value)) {
    return fail(`Frage ${questionId}: Wert muss ${allowed.join('/')} sein`);
  }
  return { ok: true, rows: [{ questionId, value: answer.value, optionId: null }] };
}

function checkChoice(question: QuestionForCheck, answer: AnswerInput): CheckResult {
  const picked = answer.optionIds ?? [];
  if (answer.value !== undefined) return fail(`Frage ${question.id}: kein Wert erlaubt`);
  if (picked.length === 0) return fail(`Frage ${question.id}: nichts ausgewählt`);
  if (new Set(picked).size !== picked.length) return fail(`Frage ${question.id}: Auswahl doppelt`);
  if (!question.multi && picked.length > 1) return fail(`Frage ${question.id}: nur eine Auswahl erlaubt`);
  const valid = new Set(question.options.filter((o) => o.active).map((o) => o.id));
  if (picked.some((optionId) => !valid.has(optionId))) return fail(`Frage ${question.id}: unbekannte Auswahl`);
  return { ok: true, rows: picked.map((optionId) => ({ questionId: question.id, value: null, optionId })) };
}

function fail(message: string): CheckResult {
  return { ok: false, message };
}
