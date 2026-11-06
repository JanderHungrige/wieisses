// The child's side: what a tablet shows today, picking or entering a sign, and handing in the
// answers to one topic (doc 01, "The child's flow" and "Repeat protection").
import type { CodePicks } from '../../shared/catalog.ts';
import { PHRASE, fixedPhrases } from '../../shared/phrases.ts';
import type { Device, KioskConfig, KioskSession, KioskTopic, SubmissionInput } from '../../shared/schema.ts';
import { codeIsActive, createCode, deviceByToken, findCode } from '../adapters/access-store.ts';
import { getTopic, kioskTopics, questionsForCheck } from '../adapters/content-store.ts';
import { getSettings } from '../adapters/settings-store.ts';
import { doneTopicIds, insertSubmission } from '../adapters/submission-store.ts';
import { validateSubmission } from '../domain/answers.ts';
import { berlinDay, isExtendedDay } from '../domain/day.ts';
import type { KioskSessionData } from '../domain/sessions.ts';
import type { App } from '../context.ts';
import { HttpError, created, ok, type Reply } from '../http/reply.ts';

export function requireDevice(app: App, token: string | undefined): Device {
  const device = token ? deviceByToken(app.db, token, app.now()) : undefined;
  if (!device) {
    throw new HttpError(403, 'device_not_registered', 'Dieses Tablet ist noch nicht freigeschaltet.');
  }
  return device;
}

export function requireKioskSession(app: App, token: string | undefined): KioskSessionData {
  const session = token ? app.kioskSessions.get(token) : undefined;
  if (!session || !codeIsActive(app.db, session.codeId)) {
    throw new HttpError(401, 'session_expired', 'Bitte tippe dein Zeichen noch einmal.');
  }
  return session;
}

function today(app: App): { day: string; extended: boolean } {
  const day = berlinDay(app.now());
  return { day, extended: isExtendedDay(day, getSettings(app.db).extendedWeekdays) };
}

function spokenTexts(topics: KioskTopic[]): string[] {
  return [
    ...fixedPhrases(),
    ...topics.flatMap((t) => [t.name, ...t.questions.flatMap((q) => [q.text, ...q.options.map((o) => o.label)])]),
  ];
}

export function kioskConfig(app: App): Reply {
  const settings = getSettings(app.db);
  const { day, extended } = today(app);
  const topics = kioskTopics(app.db, extended);
  const config: KioskConfig = {
    title: settings.title,
    today: day,
    extendedToday: extended,
    settings: {
      autoRead: settings.autoRead,
      speechRate: settings.speechRate,
      idleSeconds: settings.idleSeconds,
      grades: settings.grades,
    },
    topics,
    voice: app.voice.urls(spokenTexts(topics)),
  };
  return ok(config);
}

function startSession(app: App, codeId: number, deviceId: number): KioskSession {
  const { token, expiresInSeconds } = app.kioskSessions.create({ codeId, deviceId });
  return { token, expiresInSeconds, doneTopicIds: doneTopicIds(app.db, codeId, today(app).day) };
}

function guard(app: App, device: Device): string {
  const key = `device:${device.id}`;
  if (!app.limits.codeGuess.allowed(key)) {
    throw new HttpError(429, 'too_many_attempts', PHRASE.pauseGuess);
  }
  return key;
}

export function newCode(app: App, device: Device, input: CodePicks & { grade: number }): Reply {
  if (!getSettings(app.db).grades.includes(input.grade)) {
    throw new HttpError(400, 'validation', 'Diese Klasse gibt es hier nicht.');
  }
  const key = guard(app, device);
  if (!app.limits.newCode.allowed(key)) {
    throw new HttpError(429, 'too_many_new_codes', PHRASE.pauseNew);
  }
  const id = createCode(app.db, { ...input, deviceId: device.id, createdAt: app.now().toISOString() });
  if (id === 'taken') {
    app.limits.codeGuess.hit(key); // a "taken" tells which signs exist: count it like a guess
    throw new HttpError(409, 'code_taken', PHRASE.signTaken);
  }
  app.limits.newCode.hit(key);
  app.log.info('code created', { deviceId: device.id, grade: input.grade });
  return created(startSession(app, id, device.id));
}

export function login(app: App, device: Device, picks: CodePicks): Reply {
  const key = guard(app, device);
  const code = findCode(app.db, picks);
  if (!code || !code.active) {
    app.limits.codeGuess.hit(key);
    throw new HttpError(404, 'unknown_code', PHRASE.unknownSign);
  }
  return ok(startSession(app, code.id, device.id));
}

export function submit(app: App, session: KioskSessionData, input: SubmissionInput): Reply {
  const topic = getTopic(app.db, input.topicId);
  if (!topic || !topic.active) throw new HttpError(400, 'validation', 'Dieses Thema gibt es nicht.');
  const { day, extended } = today(app);
  const check = validateSubmission(input.answers, {
    topicId: topic.id,
    questions: questionsForCheck(app.db, topic.id),
    extendedToday: extended,
  });
  if (!check.ok) throw new HttpError(400, 'validation', check.message);
  const result = insertSubmission(app.db, {
    codeId: session.codeId,
    topicId: topic.id,
    day,
    extended,
    createdAt: app.now().toISOString(),
    rows: check.rows,
  });
  if (result === 'already_answered') {
    throw new HttpError(409, 'already_answered', PHRASE.alreadyDone);
  }
  return created({ doneTopicIds: doneTopicIds(app.db, session.codeId, day) });
}
