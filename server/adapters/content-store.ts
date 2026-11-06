// Reads of topics, questions and options — for the kiosk, for answer validation and for the
// admin editor. Writes live in content-write.ts.
import type { QuestionKind } from '../../shared/catalog.ts';
import type { AdminTopic, AnswerOption, KioskTopic, Question, Topic } from '../../shared/schema.ts';
import type { QuestionForCheck } from '../domain/answers.ts';
import { bool, type Db } from './db.ts';

type Row = Record<string, unknown>;

export function topicFromRow(row: Row): Topic {
  return {
    id: Number(row.id),
    name: String(row.name),
    color: String(row.color),
    icon: String(row.icon),
    imageUrl: (row.image_url as string | null) ?? null,
    sort: Number(row.sort),
    active: bool(row.active),
  };
}

export function questionFromRow(row: Row): Question {
  return {
    id: Number(row.id),
    topicId: Number(row.topic_id),
    kind: row.kind as QuestionKind,
    multi: bool(row.multi),
    text: String(row.text),
    icon: String(row.icon),
    imageUrl: (row.image_url as string | null) ?? null,
    audioUrl: (row.audio_url as string | null) ?? null,
    frequency: row.frequency === 'extended' ? 'extended' : 'core',
    sort: Number(row.sort),
    active: bool(row.active),
  };
}

export function optionFromRow(row: Row): AnswerOption {
  return {
    id: Number(row.id),
    questionId: Number(row.question_id),
    label: String(row.label),
    icon: String(row.icon),
    imageUrl: (row.image_url as string | null) ?? null,
    sort: Number(row.sort),
    active: bool(row.active),
  };
}

export function getTopic(db: Db, id: number): Topic | undefined {
  const row = db.prepare('SELECT * FROM topic WHERE id = ?').get(id) as Row | undefined;
  return row ? topicFromRow(row) : undefined;
}

export function getQuestion(db: Db, id: number): Question | undefined {
  const row = db.prepare('SELECT * FROM question WHERE id = ?').get(id) as Row | undefined;
  return row ? questionFromRow(row) : undefined;
}

export function getOption(db: Db, id: number): AnswerOption | undefined {
  const row = db.prepare('SELECT * FROM answer_option WHERE id = ?').get(id) as Row | undefined;
  return row ? optionFromRow(row) : undefined;
}

export function allTopics(db: Db): Topic[] {
  return (db.prepare('SELECT * FROM topic ORDER BY sort, id').all() as Row[]).map(topicFromRow);
}

export function optionsOf(db: Db, questionId: number): AnswerOption[] {
  return (db.prepare('SELECT * FROM answer_option WHERE question_id = ? ORDER BY sort, id').all(questionId) as Row[]).map(optionFromRow);
}

export function countTopics(db: Db): number {
  return Number((db.prepare('SELECT COUNT(*) AS n FROM topic').get() as Row).n);
}

function allOptions(db: Db): AnswerOption[] {
  return (db.prepare('SELECT * FROM answer_option ORDER BY sort, id').all() as Row[]).map(optionFromRow);
}

/** What a tablet shows today: active items only, extended questions only on extended days. */
export function kioskTopics(db: Db, extendedToday: boolean): KioskTopic[] {
  const topics = (db.prepare('SELECT * FROM topic WHERE active = 1 ORDER BY sort, id').all() as Row[]).map(topicFromRow);
  const questions = (
    db.prepare('SELECT * FROM question WHERE active = 1 ORDER BY sort, id').all() as Row[]
  )
    .map(questionFromRow)
    .filter((q) => q.frequency === 'core' || extendedToday);
  const options = allOptions(db).filter((o) => o.active);
  return topics
    .map((topic) => ({
      id: topic.id,
      name: topic.name,
      color: topic.color,
      icon: topic.icon,
      imageUrl: topic.imageUrl,
      questions: questions
        .filter((q) => q.topicId === topic.id)
        .map((q) => ({
          id: q.id,
          kind: q.kind,
          multi: q.multi,
          text: q.text,
          icon: q.icon,
          imageUrl: q.imageUrl,
          audioUrl: q.audioUrl,
          options: options
            .filter((o) => o.questionId === q.id)
            .map((o) => ({ id: o.id, label: o.label, icon: o.icon, imageUrl: o.imageUrl })),
        }))
        .filter((q) => q.kind !== 'choice' || q.options.length > 0),
    }))
    .filter((topic) => topic.questions.length > 0);
}

/** All questions of a topic (inactive included) with their options, for answer validation. */
export function questionsForCheck(db: Db, topicId: number): QuestionForCheck[] {
  const questions = (db.prepare('SELECT * FROM question WHERE topic_id = ?').all(topicId) as Row[]).map(questionFromRow);
  const options = (
    db
      .prepare('SELECT o.* FROM answer_option o JOIN question q ON q.id = o.question_id WHERE q.topic_id = ?')
      .all(topicId) as Row[]
  ).map(optionFromRow);
  return questions.map((q) => ({
    id: q.id,
    topicId: q.topicId,
    kind: q.kind,
    multi: q.multi,
    frequency: q.frequency,
    active: q.active,
    options: options.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, active: o.active })),
  }));
}

function counts(db: Db, sql: string): Map<number, number> {
  return new Map((db.prepare(sql).all() as Row[]).map((row) => [Number(row.id), Number(row.n)]));
}

/** Everything for the editor, inactive included, with how often each item was answered. */
export function adminTopics(db: Db): AdminTopic[] {
  const topicCounts = counts(db, 'SELECT topic_id AS id, COUNT(*) AS n FROM submission GROUP BY topic_id');
  const questionCounts = counts(db, 'SELECT question_id AS id, COUNT(DISTINCT submission_id) AS n FROM answer GROUP BY question_id');
  const optionCounts = counts(db, 'SELECT option_id AS id, COUNT(*) AS n FROM answer WHERE option_id IS NOT NULL GROUP BY option_id');
  const topics = (db.prepare('SELECT * FROM topic ORDER BY sort, id').all() as Row[]).map(topicFromRow);
  const questions = (db.prepare('SELECT * FROM question ORDER BY sort, id').all() as Row[]).map(questionFromRow);
  const options = allOptions(db);
  return topics.map((topic) => ({
    ...topic,
    answerCount: topicCounts.get(topic.id) ?? 0,
    questions: questions
      .filter((q) => q.topicId === topic.id)
      .map((q) => ({
        ...q,
        answerCount: questionCounts.get(q.id) ?? 0,
        options: options
          .filter((o) => o.questionId === q.id)
          .map((o) => ({ ...o, answerCount: optionCounts.get(o.id) ?? 0 })),
      })),
  }));
}
