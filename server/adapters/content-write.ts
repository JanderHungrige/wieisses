// Creating, changing and deleting topics, questions and options. Anything that has been answered
// is never deleted ('in_use'), so the history keeps its meaning (doc 01).
import type { z } from 'zod';
import type {
  AnswerOption,
  OptionCreate,
  OptionPatch,
  Question,
  QuestionCreate,
  QuestionPatch,
  Topic,
  TopicCreate,
  TopicPatch,
} from '../../shared/schema.ts';
import { getOption, getQuestion, getTopic } from './content-store.ts';
import { transaction, type Db } from './db.ts';

type SqlValue = string | number | null;
export type DeleteResult = 'ok' | 'in_use' | 'not_found';

const COLUMNS: Readonly<Record<string, string>> = Object.freeze({
  name: 'name',
  color: 'color',
  icon: 'icon',
  imageUrl: 'image_url',
  audioUrl: 'audio_url',
  sort: 'sort',
  active: 'active',
  kind: 'kind',
  multi: 'multi',
  text: 'text',
  frequency: 'frequency',
  label: 'label',
});

function sqlValue(value: unknown): SqlValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return null;
}

function update(db: Db, table: string, id: number, patch: Record<string, unknown>): void {
  const entries = Object.entries(patch).filter(([key, value]) => value !== undefined && COLUMNS[key]);
  if (entries.length === 0) return;
  const assignments = entries.map(([key]) => `${COLUMNS[key]} = ?`).join(', ');
  db.prepare(`UPDATE ${table} SET ${assignments} WHERE id = ?`).run(...entries.map(([, v]) => sqlValue(v)), id);
}

function used(db: Db, sql: string, id: number): boolean {
  return db.prepare(sql).get(id) !== undefined;
}

// ── Topics ─────────────────────────────────────────────────────────────────

export function insertTopic(db: Db, topic: z.output<typeof TopicCreate>, now: Date): Topic {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO topic (name, color, icon, image_url, sort, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(topic.name, topic.color, topic.icon, topic.imageUrl, topic.sort, topic.active ? 1 : 0, now.toISOString());
  return getTopic(db, Number(lastInsertRowid)) as Topic;
}

export function patchTopic(db: Db, id: number, patch: z.output<typeof TopicPatch>): Topic | undefined {
  update(db, 'topic', id, patch);
  return getTopic(db, id);
}

export function deleteTopic(db: Db, id: number): DeleteResult {
  if (!getTopic(db, id)) return 'not_found';
  if (used(db, 'SELECT 1 FROM submission WHERE topic_id = ? LIMIT 1', id)) return 'in_use';
  transaction(db, () => {
    db.prepare('DELETE FROM answer_option WHERE question_id IN (SELECT id FROM question WHERE topic_id = ?)').run(id);
    db.prepare('DELETE FROM question WHERE topic_id = ?').run(id);
    db.prepare('DELETE FROM topic WHERE id = ?').run(id);
  });
  return 'ok';
}

// ── Questions ──────────────────────────────────────────────────────────────

export function insertQuestion(db: Db, topicId: number, q: z.output<typeof QuestionCreate>, now: Date): Question {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO question (topic_id, kind, multi, text, icon, image_url, audio_url, frequency, sort, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      topicId,
      q.kind,
      q.kind === 'choice' && q.multi ? 1 : 0,
      q.text,
      q.icon,
      q.imageUrl,
      q.audioUrl,
      q.frequency,
      q.sort,
      q.active ? 1 : 0,
      now.toISOString(),
    );
  return getQuestion(db, Number(lastInsertRowid)) as Question;
}

export function questionAnswered(db: Db, id: number): boolean {
  return used(db, 'SELECT 1 FROM answer WHERE question_id = ? LIMIT 1', id);
}

export function patchQuestion(db: Db, id: number, patch: z.output<typeof QuestionPatch>): Question | undefined {
  update(db, 'question', id, patch);
  return getQuestion(db, id);
}

export function deleteQuestion(db: Db, id: number): DeleteResult {
  if (!getQuestion(db, id)) return 'not_found';
  if (questionAnswered(db, id)) return 'in_use';
  transaction(db, () => {
    db.prepare('DELETE FROM answer_option WHERE question_id = ?').run(id);
    db.prepare('DELETE FROM question WHERE id = ?').run(id);
  });
  return 'ok';
}

// ── Options ────────────────────────────────────────────────────────────────

export function insertOption(db: Db, questionId: number, o: z.output<typeof OptionCreate>): AnswerOption {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO answer_option (question_id, label, icon, image_url, sort, active) VALUES (?, ?, ?, ?, ?, ?)')
    .run(questionId, o.label, o.icon, o.imageUrl, o.sort, o.active ? 1 : 0);
  return getOption(db, Number(lastInsertRowid)) as AnswerOption;
}

export function patchOption(db: Db, id: number, patch: z.output<typeof OptionPatch>): AnswerOption | undefined {
  update(db, 'answer_option', id, patch);
  return getOption(db, id);
}

export function deleteOption(db: Db, id: number): DeleteResult {
  if (!getOption(db, id)) return 'not_found';
  if (used(db, 'SELECT 1 FROM answer WHERE option_id = ? LIMIT 1', id)) return 'in_use';
  db.prepare('DELETE FROM answer_option WHERE id = ?').run(id);
  return 'ok';
}
