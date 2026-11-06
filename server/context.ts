// Everything a handler needs, built once in main.ts (or per test) and passed down.
import type { Db } from './adapters/db.ts';
import { voiceClient } from './adapters/voice-client.ts';
import { createLimiter, type Limiter } from './domain/rate-limit.ts';
import { passwordChecker, type PasswordCheck } from './domain/secrets.ts';
import { createSessionStore, type SessionStore } from './domain/sessions.ts';
import { createVoiceQueue, type VoiceQueue } from './handlers/voice-queue.ts';
import type { Logger } from './log.ts';

export type App = {
  db: Db;
  env: string;
  mediaDir: string;
  staticDir: string;
  now: () => Date;
  log: Logger;
  passwordOk: PasswordCheck;
  limits: { login: Limiter; codeGuess: Limiter; newCode: Limiter };
  kioskSessions: SessionStore;
  voice: VoiceQueue;
};

const MINUTE = 60_000;

export function createAppContext(options: {
  db: Db;
  env: string;
  mediaDir: string;
  staticDir: string;
  adminPassword: string;
  log: Logger;
  voiceUrl?: string | null;
  now?: () => Date;
}): App {
  const now = options.now ?? (() => new Date());
  const ms = () => now().getTime();
  return {
    db: options.db,
    env: options.env,
    mediaDir: options.mediaDir,
    staticDir: options.staticDir,
    now,
    log: options.log,
    passwordOk: passwordChecker(options.adminPassword),
    limits: {
      login: createLimiter(10, 15 * MINUTE, ms),
      codeGuess: createLimiter(20, 10 * MINUTE, ms),
      newCode: createLimiter(10, 10 * MINUTE, ms),
    },
    kioskSessions: createSessionStore(20 * MINUTE, ms),
    voice: createVoiceQueue({
      db: options.db,
      mediaDir: options.mediaDir,
      synthesize: options.voiceUrl ? voiceClient(options.voiceUrl) : null,
      log: options.log,
      now,
    }),
  };
}
