// The kiosk's state machine: start → sign → topics → questions → thanks, and back to start on
// "Tschüss", on idle, or when the session expires (doc 01, "The child's flow").
import { useEffect, useState } from 'preact/hooks';
import type { CodePicks } from '../../shared/catalog.ts';
import type { AnswerInput, KioskConfig, KioskSession, KioskTopic } from '../../shared/schema.ts';
import { ApiError, api } from '../lib/api.ts';
import { initSpeech, say, stopSpeech } from '../lib/speech.ts';
import { useIdle } from './useIdle.ts';

export type Phase =
  | { name: 'loading' }
  | { name: 'unregistered' }
  | { name: 'offline'; message: string }
  | { name: 'start' }
  | { name: 'ask' }
  | { name: 'pick'; mode: 'new' | 'returning' }
  | { name: 'unknown' }
  | { name: 'welcome'; picks: CodePicks }
  | { name: 'topics'; topicId: number | null }
  | { name: 'thanks'; all: boolean };

export type Session = { token: string; done: number[] };

/** Screens without a child on them: no idle timer, no "Tschüss". */
export const RESTING = new Set<Phase['name']>(['loading', 'unregistered', 'offline', 'start']);

type Ctx = {
  config: KioskConfig | null;
  session: Session | null;
  setSession: (s: Session | null) => void;
  setPhase: (p: Phase) => void;
  reset: () => void;
};

const message = (err: unknown) => (err instanceof Error ? err.message : 'Da ist etwas schiefgegangen.');

export function useKiosk() {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [session, setSession] = useState<Session | null>(null);

  async function load(): Promise<void> {
    try {
      const next = await api<KioskConfig>('/api/v1/kiosk/config');
      setConfig(next);
      initSpeech(next.settings.speechRate, next.voice);
      setPhase({ name: 'start' });
    } catch (err) {
      const unregistered = err instanceof ApiError && err.code === 'device_not_registered';
      setPhase(unregistered ? { name: 'unregistered' } : { name: 'offline', message: message(err) });
    }
  }

  function reset(): void {
    stopSpeech();
    setSession(null);
    void load(); // fresh questions and today's date for the next child
  }

  useEffect(() => void load(), []);
  useIdle(config?.settings.idleSeconds ?? 90, !RESTING.has(phase.name), reset);

  const ctx: Ctx = { config, session, setSession, setPhase, reset };
  return {
    config,
    phase,
    session,
    setPhase,
    load,
    reset,
    enterCode: (mode: 'new' | 'returning', picks: CodePicks, grade: number | null) => enterCode(ctx, mode, picks, grade),
    submit: (topic: KioskTopic, answers: AnswerInput[]) => submit(ctx, topic, answers),
    openTopic: (topic: KioskTopic) => {
      say(topic.name, true);
      setPhase({ name: 'topics', topicId: topic.id });
    },
  };
}

/** Resolves to a message for the picker to show, or null when the flow moved on. */
async function enterCode(k: Ctx, mode: 'new' | 'returning', picks: CodePicks, grade: number | null): Promise<string | null> {
  try {
    const res =
      mode === 'new'
        ? await api<KioskSession>('/api/v1/kiosk/codes', { json: { ...picks, grade } })
        : await api<KioskSession>('/api/v1/kiosk/session', { json: picks });
    k.setSession({ token: res.token, done: res.doneTopicIds });
    k.setPhase(mode === 'new' ? { name: 'welcome', picks } : { name: 'topics', topicId: null });
    return null;
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== 'unknown_code') return message(err);
    k.setPhase({ name: 'unknown' });
    return null;
  }
}

async function submit(k: Ctx, topic: KioskTopic, answers: AnswerInput[]): Promise<void> {
  if (!k.session) return k.reset();
  if (answers.length === 0) return k.setPhase({ name: 'topics', topicId: null });
  try {
    const res = await api<{ doneTopicIds: number[] }>('/api/v1/kiosk/submissions', {
      json: { topicId: topic.id, answers },
      token: k.session.token,
    });
    finishTopic(k, res.doneTopicIds);
  } catch (err) {
    const code = err instanceof ApiError ? err.code : '';
    if (code === 'already_answered') finishTopic(k, [...k.session.done, topic.id]);
    else if (code === 'session_expired') k.reset();
    else k.setPhase({ name: 'offline', message: message(err) });
  }
}

function finishTopic(k: Ctx, done: number[]): void {
  if (!k.session || !k.config) return;
  k.setSession({ ...k.session, done });
  const all = k.config.topics.every((t) => done.includes(t.id));
  k.setPhase({ name: 'thanks', all });
  window.setTimeout(() => (all ? k.reset() : k.setPhase({ name: 'topics', topicId: null })), all ? 5000 : 2500);
}
