// Raw rows for the dashboard and the CSV export, filtered by Berlin day range and grade.
// No aggregation here — that is server/domain/stats.ts. Code ids never leave this module
// except as an opaque number for counting distinct children.
import type { QuestionKind } from '../../shared/catalog.ts';
import type { Db } from './db.ts';

export type Range = { from: string; to: string; grade?: number };
export type SubmissionRow = { submissionId: number; topicId: number; codeId: number; day: string };
export type AnswerFact = {
  submissionId: number;
  topicId: number;
  questionId: number;
  kind: QuestionKind;
  value: number | null;
  optionId: number | null;
  day: string;
};
export type ExportRow = {
  day: string;
  grade: number;
  topic: string;
  question: string;
  kind: QuestionKind;
  value: number | null;
  option: string | null;
  extended: boolean;
};

type Row = Record<string, unknown>;
const RANGE = 's.day BETWEEN ?1 AND ?2 AND (?3 IS NULL OR c.grade = ?3)';

export function submissionRows(db: Db, range: Range): SubmissionRow[] {
  const rows = db
    .prepare(`SELECT s.id, s.topic_id, s.code_id, s.day FROM submission s JOIN child_code c ON c.id = s.code_id WHERE ${RANGE}`)
    .all(range.from, range.to, range.grade ?? null) as Row[];
  return rows.map((r) => ({ submissionId: Number(r.id), topicId: Number(r.topic_id), codeId: Number(r.code_id), day: String(r.day) }));
}

export function answerFacts(db: Db, range: Range, questionId?: number): AnswerFact[] {
  const rows = db
    .prepare(
      `SELECT a.submission_id, s.topic_id, a.question_id, q.kind, a.value, a.option_id, s.day
       FROM answer a
       JOIN submission s ON s.id = a.submission_id
       JOIN child_code c ON c.id = s.code_id
       JOIN question q ON q.id = a.question_id
       WHERE ${RANGE} AND (?4 IS NULL OR a.question_id = ?4)`,
    )
    .all(range.from, range.to, range.grade ?? null, questionId ?? null) as Row[];
  return rows.map((r) => ({
    submissionId: Number(r.submission_id),
    topicId: Number(r.topic_id),
    questionId: Number(r.question_id),
    kind: r.kind as QuestionKind,
    value: r.value === null ? null : Number(r.value),
    optionId: r.option_id === null ? null : Number(r.option_id),
    day: String(r.day),
  }));
}

export function exportRows(db: Db, range: Range): ExportRow[] {
  const rows = db
    .prepare(
      `SELECT s.day, c.grade, t.name AS topic, q.text AS question, q.kind, a.value, o.label AS option, s.extended
       FROM answer a
       JOIN submission s ON s.id = a.submission_id
       JOIN child_code c ON c.id = s.code_id
       JOIN topic t ON t.id = s.topic_id
       JOIN question q ON q.id = a.question_id
       LEFT JOIN answer_option o ON o.id = a.option_id
       WHERE ${RANGE}
       ORDER BY s.day, s.id, q.sort, q.id, o.sort, o.id`,
    )
    .all(range.from, range.to, range.grade ?? null) as Row[];
  return rows.map((r) => ({
    day: String(r.day),
    grade: Number(r.grade),
    topic: String(r.topic),
    question: String(r.question),
    kind: r.kind as QuestionKind,
    value: r.value === null ? null : Number(r.value),
    option: (r.option as string | null) ?? null,
    extended: Number(r.extended) === 1,
  }));
}
