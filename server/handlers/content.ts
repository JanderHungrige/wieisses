// The question editor: topics, questions and options (doc 01, "Admin"). Answered items are
// deactivated, never deleted, and an answered question keeps its kind.
import type { z } from 'zod';
import { normaliseText } from '../../shared/phrases.ts';
import type { AdminTopic, OptionCreate, OptionPatch, QuestionCreate, QuestionPatch, TopicCreate, TopicPatch } from '../../shared/schema.ts';
import { adminTopics, getQuestion, getTopic } from '../adapters/content-store.ts';
import {
  deleteOption,
  deleteQuestion,
  deleteTopic,
  insertOption,
  insertQuestion,
  insertTopic,
  patchOption,
  patchQuestion,
  patchTopic,
  questionAnswered,
  type DeleteResult,
} from '../adapters/content-write.ts';
import type { App } from '../context.ts';
import { HttpError, created, noContent, ok, type Reply } from '../http/reply.ts';

function notFound(what: string): HttpError {
  return new HttpError(404, 'not_found', `${what} gibt es nicht.`);
}

function deleted(result: DeleteResult, what: string): Reply {
  switch (result) {
    case 'ok':
      return noContent();
    case 'not_found':
      throw notFound(what);
    case 'in_use':
      throw new HttpError(409, 'in_use', `${what} wurde schon beantwortet — bitte deaktivieren statt löschen.`);
    default:
      throw new Error(`unhandled delete result: ${result satisfies never}`);
  }
}

export function listTopics(app: App): Reply {
  const topics = adminTopics(app.db);
  const texts = topics.flatMap((t) => [t.name, ...t.questions.flatMap((q) => [q.text, ...q.options.map((o) => o.label)])]);
  const urls = app.voice.urls(texts);
  const voiceUrl = (text: string) => urls[normaliseText(text)] ?? null;
  const voiced: AdminTopic[] = topics.map((t) => ({
    ...t,
    voiceUrl: voiceUrl(t.name),
    questions: t.questions.map((q) => ({
      ...q,
      voiceUrl: voiceUrl(q.text),
      options: q.options.map((o) => ({ ...o, voiceUrl: voiceUrl(o.label) })),
    })),
  }));
  return ok(voiced);
}

export function createTopic(app: App, input: z.output<typeof TopicCreate>): Reply {
  return created(insertTopic(app.db, input, app.now()));
}

export function updateTopic(app: App, id: number, patch: z.output<typeof TopicPatch>): Reply {
  const topic = patchTopic(app.db, id, patch);
  if (!topic) throw notFound('Dieses Thema');
  return ok(topic);
}

export function removeTopic(app: App, id: number): Reply {
  return deleted(deleteTopic(app.db, id), 'Dieses Thema');
}

export function createQuestion(app: App, topicId: number, input: z.output<typeof QuestionCreate>): Reply {
  if (!getTopic(app.db, topicId)) throw notFound('Dieses Thema');
  return created(insertQuestion(app.db, topicId, input, app.now()));
}

export function updateQuestion(app: App, id: number, patch: z.output<typeof QuestionPatch>): Reply {
  const current = getQuestion(app.db, id);
  if (!current) throw notFound('Diese Frage');
  const kind = patch.kind ?? current.kind;
  if (kind !== current.kind && questionAnswered(app.db, id)) {
    throw new HttpError(409, 'in_use', 'Die Art einer beantworteten Frage lässt sich nicht ändern — bitte eine neue Frage anlegen.');
  }
  const multi = kind === 'choice' ? (patch.multi ?? current.multi) : false;
  return ok(patchQuestion(app.db, id, { ...patch, multi }));
}

export function removeQuestion(app: App, id: number): Reply {
  return deleted(deleteQuestion(app.db, id), 'Diese Frage');
}

export function createOption(app: App, questionId: number, input: z.output<typeof OptionCreate>): Reply {
  const question = getQuestion(app.db, questionId);
  if (!question) throw notFound('Diese Frage');
  if (question.kind !== 'choice') {
    throw new HttpError(400, 'validation', 'Nur Auswahl-Fragen haben eigene Antworten.');
  }
  return created(insertOption(app.db, questionId, input));
}

export function updateOption(app: App, id: number, patch: z.output<typeof OptionPatch>): Reply {
  const option = patchOption(app.db, id, patch);
  if (!option) throw notFound('Diese Antwort');
  return ok(option);
}

export function removeOption(app: App, id: number): Reply {
  return deleted(deleteOption(app.db, id), 'Diese Antwort');
}
