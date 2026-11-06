// Reading requests: bounded bodies, schema-checked JSON, cookies, bearer tokens and the client
// address — X-Forwarded-* only believed when the direct peer is the proxy (doc 01, "Security").
import type { IncomingMessage } from 'node:http';
import type { z } from 'zod';
import { HttpError } from './reply.ts';

export const JSON_LIMIT = 64 * 1024;
export const DEVICE_COOKIE = 'wi_device';
export const ADMIN_COOKIE = 'wi_admin';

export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new HttpError(413, 'too_large', 'Die Datei ist zu groß.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'too_large', 'Die Datei ist zu groß.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson<S extends z.ZodType>(req: IncomingMessage, schema: S): Promise<z.output<S>> {
  const type = req.headers['content-type'] ?? '';
  if (!type.startsWith('application/json')) throw new HttpError(415, 'unsupported_type', 'JSON erwartet.');
  const raw = await readBody(req, JSON_LIMIT);
  let data: unknown;
  try {
    data = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'validation', 'Ungültiges JSON.');
  }
  return parseWith(schema, data);
}

export function parseWith<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.') || 'Eingabe';
    throw new HttpError(400, 'validation', `${where}: ${issue?.message ?? 'ungültig'}`);
  }
  return result.data;
}

export function cookies(req: IncomingMessage): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    jar.set(part.slice(0, eq).trim(), decodeURIComponent(part.slice(eq + 1).trim()));
  }
  return jar;
}

export function bearer(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() || undefined : undefined;
}

function ipv4(address: string): number | undefined {
  const plain = address.startsWith('::ffff:') ? address.slice(7) : address;
  const parts = plain.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return undefined;
  return parts.reduce((acc, p) => acc * 256 + p, 0);
}

/** Loopback and Docker's 172.16.0.0/12 — where Nginx Proxy Manager's requests come from. */
export function isTrustedProxy(address: string | undefined): boolean {
  if (!address) return false;
  if (address === '::1') return true;
  const n = ipv4(address);
  if (n === undefined) return false;
  const inRange = (base: number, bits: number) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits));
  return inRange(ipv4('127.0.0.0') ?? 0, 8) || inRange(ipv4('172.16.0.0') ?? 0, 12);
}

/** The visitor's address: the last X-Forwarded-For entry when the peer is the proxy. */
export function clientIp(req: IncomingMessage): string {
  const peer = req.socket.remoteAddress ?? 'unknown';
  const forwarded = req.headers['x-forwarded-for'];
  if (!isTrustedProxy(peer) || typeof forwarded !== 'string') return peer;
  const last = forwarded.split(',').map((s) => s.trim()).filter(Boolean).pop();
  return last ?? peer;
}

export function isHttps(req: IncomingMessage): boolean {
  return isTrustedProxy(req.socket.remoteAddress) && req.headers['x-forwarded-proto'] === 'https';
}

export function cookieHeader(req: IncomingMessage, name: string, value: string, maxAgeSeconds: number): string {
  const secure = isHttps(req) ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}
