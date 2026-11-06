// A child's kiosk session: a short-lived bearer token held only in the tablet's memory and here.
// A restart forgets them all, which only means the child taps their sign again.
import { newToken } from './secrets.ts';

export type KioskSessionData = { codeId: number; deviceId: number };

export type SessionStore = {
  create(data: KioskSessionData): { token: string; expiresInSeconds: number };
  get(token: string): KioskSessionData | undefined;
};

export function createSessionStore(ttlMs: number, now: () => number = Date.now): SessionStore {
  const sessions = new Map<string, KioskSessionData & { expiresAt: number }>();

  function prune(): void {
    const t = now();
    for (const [token, session] of sessions) if (session.expiresAt <= t) sessions.delete(token);
  }

  return {
    create(data) {
      prune();
      const token = newToken();
      sessions.set(token, { ...data, expiresAt: now() + ttlMs });
      return { token, expiresInSeconds: Math.floor(ttlMs / 1000) };
    },
    get(token) {
      const session = sessions.get(token);
      if (!session || session.expiresAt <= now()) return undefined;
      return { codeId: session.codeId, deviceId: session.deviceId };
    },
  };
}
