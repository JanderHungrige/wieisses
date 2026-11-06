// Children's signs, registered tablets and settings, as seen from the admin panel (doc 01).
import type { CodesOverview, Settings } from '../../shared/schema.ts';
import { listCodes, listDevices, newCodesPerDay, registerDevice, updateCode, updateDevice } from '../adapters/access-store.ts';
import { getSettings, saveSettings } from '../adapters/settings-store.ts';
import type { App } from '../context.ts';
import { HttpError, created, ok, type Reply } from '../http/reply.ts';
import type { CookieFor } from './admin-auth.ts';

export const DEVICE_COOKIE_SECONDS = 400 * 24 * 60 * 60;
const DAY_MS = 86_400_000;

export function codesOverview(app: App, filter: { grade?: number; active?: boolean }): Reply {
  const since = new Date(app.now().getTime() - 13 * DAY_MS).toISOString().slice(0, 10);
  const overview: CodesOverview = { codes: listCodes(app.db, filter), newPerDay: newCodesPerDay(app.db, since) };
  return ok(overview);
}

export function changeCode(app: App, id: number, patch: { active?: boolean; grade?: number }): Reply {
  const code = updateCode(app.db, id, patch);
  if (!code) throw new HttpError(404, 'not_found', 'Dieses Zeichen gibt es nicht.');
  return ok(code);
}

export function devices(app: App): Reply {
  return ok(listDevices(app.db));
}

/** Registers the browser that sends this request — the admin does it on the tablet itself. */
export function registerThisDevice(app: App, label: string, cookieFor: CookieFor): Reply {
  const { device, token } = registerDevice(app.db, label, app.now());
  app.log.info('device registered', { deviceId: device.id });
  return { ...created(device), headers: { 'Set-Cookie': cookieFor(token, DEVICE_COOKIE_SECONDS) } };
}

export function changeDevice(app: App, id: number, patch: { label?: string; revoked?: boolean }): Reply {
  const device = updateDevice(app.db, id, patch);
  if (!device) throw new HttpError(404, 'not_found', 'Dieses Tablet gibt es nicht.');
  return ok(device);
}

export function settings(app: App): Reply {
  return ok(getSettings(app.db));
}

export function replaceSettings(app: App, next: Settings): Reply {
  saveSettings(app.db, next);
  return ok(getSettings(app.db));
}
