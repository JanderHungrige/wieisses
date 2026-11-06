// Tokens and the admin password. A token is handed out once (cookie or response body) and only
// its sha256 is stored, so a copy of the database logs nobody in (doc 01, "Security").
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Random 32-hex-character name for an uploaded file. */
export function newFileId(): string {
  return randomBytes(16).toString('hex');
}

export type PasswordCheck = (attempt: string) => boolean;

/** Hashes the configured password once; attempts are compared hash to hash in constant time. */
export function passwordChecker(password: string): PasswordCheck {
  const salt = randomBytes(16);
  const expected = scryptSync(password, salt, 32);
  return (attempt) => timingSafeEqual(scryptSync(attempt, salt, 32), expected);
}
