// Admin login with the one configured password, a 12-hour session cookie, and the throttle
// against guessing it (doc 01, "Admin").
import { adminSessionValid, createAdminSession, deleteAdminSession } from '../adapters/access-store.ts';
import type { App } from '../context.ts';
import { HttpError, noContent, type Reply } from '../http/reply.ts';

export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;

export type CookieFor = (token: string, maxAgeSeconds: number) => string;

export function loginAdmin(app: App, ip: string, password: string, cookieFor: CookieFor): Reply {
  if (!app.limits.login.allowed(ip)) {
    throw new HttpError(429, 'too_many_attempts', 'Zu viele Versuche. Bitte in 15 Minuten nochmal.');
  }
  if (!app.passwordOk(password)) {
    app.limits.login.hit(ip);
    app.log.warn('admin login failed');
    throw new HttpError(401, 'wrong_password', 'Das Passwort stimmt nicht.');
  }
  const token = createAdminSession(app.db, app.now(), ADMIN_SESSION_SECONDS * 1000);
  app.log.info('admin login');
  return noContent({ 'Set-Cookie': cookieFor(token, ADMIN_SESSION_SECONDS) });
}

export function requireAdmin(app: App, token: string | undefined): void {
  if (!token || !adminSessionValid(app.db, token, app.now())) {
    throw new HttpError(401, 'not_logged_in', 'Bitte anmelden.');
  }
}

export function logoutAdmin(app: App, token: string | undefined, cookieFor: CookieFor): Reply {
  if (token) deleteAdminSession(app.db, token);
  return noContent({ 'Set-Cookie': cookieFor('', 0) });
}
