// The voicing queue (doc 01, "Voice (Thorsten)"): one text at a time, oldest first, a text queued
// twice only once. Runs are started by "Speichern & vertonen", "Alle neu vertonen", a changed
// speech rate and the server start — never by an individual save.
import { normaliseText } from '../../shared/phrases.ts';
import type { VoiceStatus } from '../../shared/schema.ts';
import { adminTopics } from '../adapters/content-store.ts';
import type { Db } from '../adapters/db.ts';
import { getSettings } from '../adapters/settings-store.ts';
import { VoiceUnreachable, type Synthesize } from '../adapters/voice-client.ts';
import { clipUrls, pruneClips, saveClip } from '../adapters/voice-store.ts';
import { VOICE_NAME, clipKey, lengthScaleFor, wantedTexts } from '../domain/voice-texts.ts';
import type { Logger } from '../log.ts';

export type VoiceQueue = {
  configured: boolean;
  status(): VoiceStatus;
  /** Queues every wanted text without a clip ('missing') or every wanted text ('all'). */
  generate(mode: 'missing' | 'all'): void;
  /** Queues one text again; false when the kiosk never speaks it. */
  revoice(text: string): boolean;
  /** Normalised text → clip URL for those of `texts` that have one at the current speed. */
  urls(texts: Iterable<string>): Record<string, string>;
  /** Resolves once the queue is empty and no run is active (tests, shutdown). */
  idle(): Promise<void>;
};

type Job = { key: string; text: string; lengthScale: number };
type Deps = { db: Db; mediaDir: string; synthesize: Synthesize | null; log: Logger; now: () => Date };

export function createVoiceQueue(deps: Deps): VoiceQueue {
  const { db, synthesize } = deps;
  const queue = new Map<string, Job>();
  const failed = new Map<string, string>();
  let working: string | null = null;
  let reachable: boolean | null = null;
  let running: Promise<void> | null = null;

  const current = () => {
    const lengthScale = lengthScaleFor(getSettings(db).speechRate);
    return { lengthScale, wanted: wantedTexts(adminTopics(db)) };
  };

  function enqueue(text: string, lengthScale: number): void {
    const key = clipKey(text, lengthScale);
    if (!queue.has(key)) queue.set(key, { key, text, lengthScale });
  }

  async function runOne(job: Job, speak: Synthesize): Promise<'ok' | 'failed' | 'unreachable'> {
    working = job.text;
    try {
      const mp3 = await speak(job.text, job.lengthScale);
      await saveClip(db, deps.mediaDir, { key: job.key, text: job.text, mp3, now: deps.now() });
      failed.delete(job.text);
      reachable = true;
      return 'ok';
    } catch (err) {
      failed.set(job.text, err instanceof Error ? err.message : String(err));
      if (err instanceof VoiceUnreachable) {
        reachable = false;
        return 'unreachable';
      }
      return 'failed';
    }
  }

  async function run(speak: Synthesize): Promise<void> {
    let clean = true;
    for (let job = queue.values().next().value; job; job = queue.values().next().value) {
      queue.delete(job.key);
      const result = await runOne(job, speak);
      if (result !== 'ok') clean = false;
      if (result === 'unreachable') queue.clear();
    }
    working = null;
    if (clean) await pruneIfComplete();
  }

  async function pruneIfComplete(): Promise<void> {
    const { lengthScale, wanted } = current();
    const have = clipUrls(db);
    const keep = new Set(wanted.map((text) => clipKey(text, lengthScale)));
    if ([...keep].every((key) => have.has(key))) {
      const removed = await pruneClips(db, deps.mediaDir, keep);
      if (removed > 0) deps.log.info('voice clips pruned', { removed });
    }
  }

  function start(): void {
    if (running || !synthesize || queue.size === 0) return;
    deps.log.info('voicing', { texts: queue.size });
    running = run(synthesize)
      .catch((err: unknown) => deps.log.error('voicing failed', { err: err instanceof Error ? err : String(err) }))
      .finally(() => {
        running = null;
        start(); // texts queued while the run was finishing
      });
  }

  return {
    configured: synthesize !== null,
    status() {
      const { lengthScale, wanted } = current();
      const have = clipUrls(db);
      const wantedSet = new Set(wanted);
      return {
        configured: synthesize !== null,
        reachable,
        voice: VOICE_NAME,
        lengthScale,
        total: wanted.length,
        ready: wanted.filter((text) => have.has(clipKey(text, lengthScale))).length,
        queued: queue.size,
        working,
        failed: [...failed].filter(([text]) => wantedSet.has(text)).map(([text, message]) => ({ text, message })),
      };
    },
    generate(mode) {
      const { lengthScale, wanted } = current();
      const have = clipUrls(db);
      for (const text of wanted) if (mode === 'all' || !have.has(clipKey(text, lengthScale))) enqueue(text, lengthScale);
      start();
    },
    revoice(text) {
      const { lengthScale, wanted } = current();
      const normal = normaliseText(text);
      if (!wanted.includes(normal)) return false;
      enqueue(normal, lengthScale);
      start();
      return true;
    },
    urls(texts) {
      const lengthScale = lengthScaleFor(getSettings(db).speechRate);
      const have = clipUrls(db);
      const result: Record<string, string> = {};
      for (const text of texts) {
        const normal = normaliseText(text);
        const url = have.get(clipKey(normal, lengthScale));
        if (url) result[normal] = url;
      }
      return result;
    },
    async idle() {
      while (running) await running;
    },
  };
}
