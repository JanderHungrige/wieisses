// What the command-line tools on the live database share (doc 04, "Architecture"): open the
// database only when it exists and is current, read and validate stdin, log to stderr so stdout
// stays the result, and turn bad usage into exit code 2.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { z } from 'zod';
import { openDatabase, schemaVersion, SCHEMA_VERSION, type Db } from '../adapters/db.ts';
import type { Fields, Logger } from '../log.ts';

/** Bad usage or unreadable input: exit code 2. */
export class UsageError extends Error {}

export function dataDir(): string {
  return resolve(process.env.DATA_DIR ?? '/data');
}

export function openLiveDatabase(): Db {
  const file = join(dataDir(), 'wieisses.sqlite');
  if (!existsSync(file)) throw new UsageError(`Keine Datenbank unter ${file}.`);
  const db = openDatabase(file);
  const version = schemaVersion(db);
  if (version !== SCHEMA_VERSION) {
    db.close();
    throw new UsageError(`Die Datenbank hat Schema ${version}, dieses Programm erwartet ${SCHEMA_VERSION}.`);
  }
  return db;
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** JSON text → `schema`'s output, or a UsageError naming each problem by its path. */
export function parseInput<S extends z.ZodType>(schema: S, text: string): z.output<S> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new UsageError(`Die Eingabe ist kein gültiges JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.') || '(Liste)'}: ${issue.message}`);
  throw new UsageError(['Die Änderungsliste passt nicht:', ...problems].join('\n'));
}

function write(level: string, msg: string, fields: Fields = {}): void {
  const extra = Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields, (_key, value: unknown) => (value instanceof Error ? value.message : value))}` : '';
  process.stderr.write(`[${level}] ${msg}${extra}\n`);
}

export const stderrLog: Logger = {
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
};

/** Runs a tool's main with the arguments; its result is the exit code. */
export async function runTool(main: (args: string[]) => Promise<number>): Promise<void> {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 2;
  }
}
