// The two command-line tools as Claude runs them in the container (doc 04, "Command line"):
// a real data directory, stdin in, stdout/stderr and exit code out.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CountedTopic } from '../../shared/schema.ts';
import { adminTopics } from '../../server/adapters/content-store.ts';
import { migrate, openDatabase } from '../../server/adapters/db.ts';
import { seedIfEmpty } from '../../server/seed.ts';
import { startFakeVoice, type FakeVoice } from './fake-voice.ts';

const ROOT = join(import.meta.dirname, '..', '..');
let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'wieisses-ops-'));
  const db = openDatabase(join(dir, 'wieisses.sqlite'));
  await migrate(db, null, new Date());
  seedIfEmpty(db, new Date());
  db.close();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

type Run = { code: number | null; stdout: string; stderr: string };

function run(tool: string, args: string[], input = '', env: Record<string, string> = {}): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', `server/ops/${tool}.ts`, ...args], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '', DATA_DIR: dir, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

function live(): CountedTopic[] {
  const db = openDatabase(join(dir, 'wieisses.sqlite'));
  try {
    return adminTopics(db);
  } finally {
    db.close();
  }
}

const essenTime = () => live()[0]?.questions.find((q) => q.text === 'Hattest du genug Zeit zum Essen?');

function changeList(): string {
  const id = essenTime()?.id;
  return JSON.stringify([{ op: 'question.update', id, patch: { text: 'Hattest du heute genug Zeit zum Essen?' } }]);
}

describe('questions.ts', () => {
  it('export prints the content with ids and answer counts as JSON', async () => {
    const res = await run('questions', ['export']);
    expect(res.code).toBe(0);
    const topics = JSON.parse(res.stdout) as CountedTopic[];
    expect(topics.map((t) => t.name)).toEqual(['Essen', 'Hausaufgaben', 'Miteinander', 'Spielen & Basteln']);
    expect(topics[0]?.questions[0]).toMatchObject({ id: expect.any(Number), text: 'Wie hat dir das Essen heute geschmeckt?', answerCount: 0 });
  });

  it('apply without --yes is a dry run', async () => {
    const before = live();
    const res = await run('questions', ['apply'], changeList());
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('„Hattest du genug Zeit zum Essen?“ → „Hattest du heute genug Zeit zum Essen?“');
    expect(res.stdout.trim().split('\n').at(-1)).toBe('Probelauf — nichts gespeichert. Zum Speichern dasselbe mit --yes.');
    expect(live()).toEqual(before);
  });

  it('apply --yes backs up, writes and reports skipped voicing without VOICE_URL', async () => {
    const res = await run('questions', ['apply', '--yes'], changeList());
    expect(res.code).toBe(0);
    const backup = /Gespeichert\. Backup: (\S+\.sqlite)/.exec(res.stdout)?.[1];
    expect(backup).toBeDefined();
    expect(existsSync(backup ?? '')).toBe(true);
    expect(readdirSync(join(dir, 'backups')).some((f) => /^pre-questions-.*\.sqlite$/.test(f))).toBe(true);
    expect(res.stdout).toContain('Vertonung übersprungen (kein VOICE_URL).');
    expect(essenTime()).toBeUndefined();
  });

  it('apply --yes voices the new texts through the voice service', async () => {
    const voice: FakeVoice = await startFakeVoice();
    try {
      const res = await run('questions', ['apply', '--yes'], changeList(), { VOICE_URL: voice.url });
      expect(res.code).toBe(0);
      expect(voice.requests.map((r) => r.text)).toContain('Hattest du heute genug Zeit zum Essen?');
      expect(res.stdout).toMatch(/Vertont: \d+ Texte, 0 fehlgeschlagen\./);
    } finally {
      await voice.close();
    }
  });

  it('apply --yes --no-voice skips voicing', async () => {
    const res = await run('questions', ['apply', '--yes', '--no-voice'], changeList(), { VOICE_URL: 'http://127.0.0.1:9' });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Vertonung übersprungen (--no-voice).');
  });

  it('exits 1 with the reason when a change is refused, and writes nothing', async () => {
    const before = live();
    const res = await run('questions', ['apply', '--yes'], JSON.stringify([{ op: 'question.update', id: 999, patch: { text: 'x' } }]));
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('Änderung 1 (question.update 999): Diese Frage gibt es nicht.');
    expect(live()).toEqual(before);
    expect(existsSync(join(dir, 'backups'))).toBe(false);
  });

  it('exits 2 on a change list that does not parse, and on bad usage', async () => {
    expect((await run('questions', ['apply'], '{not json')).code).toBe(2);
    const invalid = await run('questions', ['apply'], JSON.stringify([{ op: 'question.update', id: 1, patch: { text: '' } }]));
    expect(invalid.code).toBe(2);
    expect(invalid.stderr).toContain('patch.text');
    const usage = await run('questions', ['rename']);
    expect(usage.code).toBe(2);
    expect(usage.stderr).toContain('questions.ts export');
  });

  it('refuses a data directory without a database', async () => {
    const res = await run('questions', ['export'], '', { DATA_DIR: join(dir, 'missing') });
    expect(res.code).toBe(2);
    expect(res.stderr).toContain('Keine Datenbank');
    expect(existsSync(join(dir, 'missing', 'wieisses.sqlite'))).toBe(false);
  });
});

describe('demo.ts', () => {
  it('adds, reports and removes the demo set', async () => {
    const added = await run('demo', ['add']);
    expect(added.code).toBe(0);
    expect(added.stdout).toMatch(/^Beispieldaten: 45 Bildzeichen, \d+ Antworten \(\d{4}-\d\d-\d\d bis \d{4}-\d\d-\d\d\)\.$/m);
    expect((await run('demo', ['add'])).stdout).toContain('Beispieldaten gibt es schon');
    expect((await run('demo', ['status'])).stdout).toMatch(/^Beispieldaten: 45 Bildzeichen/m);
    const removed = await run('demo', ['remove']);
    expect(removed.code).toBe(0);
    expect(removed.stdout).toMatch(/^Entfernt: 45 Bildzeichen, \d+ Antworten\.$/m);
    expect((await run('demo', ['remove'])).stdout).toContain('Keine Beispieldaten vorhanden.');
    expect((await run('demo', ['status'])).stdout).toContain('Keine Beispieldaten vorhanden.');
  });
});
