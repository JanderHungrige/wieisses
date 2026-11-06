// What handlers return and how it is written: JSON by default, errors as
// { error, message } with a German message meant for the adult reading it.
import type { ServerResponse } from 'node:http';

export type Reply = {
  status: number;
  body?: unknown;
  /** Raw payload (CSV, files); `type` is then required. */
  raw?: Buffer | string;
  type?: string;
  headers?: Record<string, string | string[]>;
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const ok = (body: unknown): Reply => ({ status: 200, body });
export const created = (body: unknown): Reply => ({ status: 201, body });
export const noContent = (headers?: Reply['headers']): Reply => ({ status: 204, headers });

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; " +
    "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
});

export function writeReply(res: ServerResponse, reply: Reply, extraHeaders: Record<string, string> = {}): void {
  const headers: Record<string, string | string[]> = { ...SECURITY_HEADERS, ...extraHeaders, ...reply.headers };
  if (reply.raw !== undefined) {
    headers['Content-Type'] = reply.type ?? 'application/octet-stream';
    res.writeHead(reply.status, headers);
    res.end(reply.raw);
    return;
  }
  if (reply.body === undefined) {
    res.writeHead(reply.status, headers);
    res.end();
    return;
  }
  headers['Content-Type'] = 'application/json; charset=utf-8';
  headers['Cache-Control'] = 'no-store';
  res.writeHead(reply.status, headers);
  res.end(JSON.stringify(reply.body));
}

export function errorReply(err: HttpError): Reply {
  return { status: err.status, body: { error: err.code, message: err.message } };
}
