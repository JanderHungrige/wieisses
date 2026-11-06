// Admin voice routes (doc 01, "API Endpoints" → Voice).
import type { App } from '../context.ts';
import { HttpError, ok, type Reply } from '../http/reply.ts';

function requireConfigured(app: App): void {
  if (!app.voice.configured) {
    throw new HttpError(503, 'voice_unavailable', 'Die Thorsten-Stimme ist auf diesem Server nicht eingerichtet.');
  }
}

export function voiceStatus(app: App): Reply {
  return ok(app.voice.status());
}

export function generateVoice(app: App, mode: 'missing' | 'all'): Reply {
  requireConfigured(app);
  app.voice.generate(mode);
  return { status: 202, body: app.voice.status() };
}

export function revoiceText(app: App, text: string): Reply {
  requireConfigured(app);
  if (!app.voice.revoice(text)) {
    throw new HttpError(400, 'validation', 'Diesen Text liest das Tablet nicht vor.');
  }
  return { status: 202, body: app.voice.status() };
}
