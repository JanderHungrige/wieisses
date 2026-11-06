// Stores a child's answers to one topic, at most once per code, topic and Berlin day (doc 01).
import type { AnswerRow } from '../domain/answers.ts';
import { isUniqueViolation, transaction, type Db } from './db.ts';

export function doneTopicIds(db: Db, codeId: number, day: string): number[] {
  const rows = db
    .prepare('SELECT topic_id FROM submission WHERE code_id = ? AND day = ? ORDER BY topic_id')
    .all(codeId, day) as { topic_id: number }[];
  return rows.map((row) => Number(row.topic_id));
}

export type NewSubmission = {
  codeId: number;
  topicId: number;
  day: string;
  extended: boolean;
  createdAt: string;
  rows: readonly AnswerRow[];
};

/** Inserts the submission and its answers atomically; 'already_answered' when one exists. */
export function insertSubmission(db: Db, sub: NewSubmission): 'ok' | 'already_answered' {
  try {
    return transaction(db, () => {
      const exists = db
        .prepare('SELECT 1 FROM submission WHERE code_id = ? AND topic_id = ? AND day = ?')
        .get(sub.codeId, sub.topicId, sub.day);
      if (exists) return 'already_answered';
      const { lastInsertRowid } = db
        .prepare('INSERT INTO submission (code_id, topic_id, day, extended, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(sub.codeId, sub.topicId, sub.day, sub.extended ? 1 : 0, sub.createdAt);
      const insert = db.prepare('INSERT INTO answer (submission_id, question_id, value, option_id) VALUES (?, ?, ?, ?)');
      for (const row of sub.rows) insert.run(lastInsertRowid, row.questionId, row.value, row.optionId);
      return 'ok';
    });
  } catch (err) {
    if (isUniqueViolation(err)) return 'already_answered';
    throw err;
  }
}
