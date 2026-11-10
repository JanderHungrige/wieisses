// The question tool (doc 04), run inside the app container:
//   node server/ops/questions.ts export                      → the content as JSON
//   node server/ops/questions.ts apply [--yes] [--no-voice]  ← a change list (JSON) on stdin
// `apply` alone is a dry run. With --yes: backup, one transaction, then the missing texts are
// voiced. Exit 0 done, 1 a change was refused (nothing written), 2 bad usage or input.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ContentChangeList } from '../../shared/schema.ts';
import { adminTopics } from '../adapters/content-store.ts';
import { backupDatabase, type Db } from '../adapters/db.ts';
import { voiceClient } from '../adapters/voice-client.ts';
import { applyChanges, ChangeRefused, type ChangeOutcome } from '../handlers/question-changes.ts';
import { createVoiceQueue } from '../handlers/voice-queue.ts';
import { dataDir, openLiveDatabase, parseInput, readStdin, runTool, stderrLog, UsageError } from './cli.ts';

const USAGE = 'usage: questions.ts export | questions.ts apply [--yes] [--no-voice]   (Änderungsliste als JSON auf stdin)';
const say = (line: string) => process.stdout.write(`${line}\n`);

async function voiceMissing(db: Db, flags: readonly string[]): Promise<string> {
  if (flags.includes('--no-voice')) return 'Vertonung übersprungen (--no-voice).';
  const url = process.env.VOICE_URL?.replace(/\/+$/, '');
  if (!url) return 'Vertonung übersprungen (kein VOICE_URL).';
  const mediaDir = join(dataDir(), 'media');
  mkdirSync(mediaDir, { recursive: true });
  const queue = createVoiceQueue({ db, mediaDir, synthesize: voiceClient(url), log: stderrLog, now: () => new Date() });
  const before = queue.status().ready;
  queue.generate('missing');
  await queue.idle();
  const after = queue.status();
  const report = `Vertont: ${after.ready - before} Texte, ${after.total - after.ready} fehlgeschlagen.`;
  if (after.reachable === false) return `${report} Der Sprachdienst war nicht erreichbar — später „Fehlende vertonen“ im Admin-Bereich.`;
  return report;
}

function report(outcome: ChangeOutcome): void {
  if (outcome.lines.length === 0) say('Keine Änderung.');
  for (const line of outcome.lines) say(line);
}

async function apply(flags: readonly string[]): Promise<number> {
  const changes = parseInput(ContentChangeList, await readStdin());
  const db = openLiveDatabase();
  const deps = { db, now: () => new Date() };
  try {
    // The dry run first: a refused list stops here, before a backup is taken.
    const preview = applyChanges(deps, changes, false);
    if (!flags.includes('--yes')) {
      report(preview);
      say('Probelauf — nichts gespeichert. Zum Speichern dasselbe mit --yes.');
      return 0;
    }
    const backup = await backupDatabase(db, join(dataDir(), 'backups'), 'pre-questions', new Date());
    report(applyChanges(deps, changes, true));
    say(`Gespeichert. Backup: ${backup}`);
    say(await voiceMissing(db, flags));
    return 0;
  } catch (err) {
    if (!(err instanceof ChangeRefused)) throw err;
    process.stderr.write(`${err.message}\nNichts gespeichert.\n`);
    return 1;
  } finally {
    db.close();
  }
}

function exportContent(): number {
  const db = openLiveDatabase();
  try {
    say(JSON.stringify(adminTopics(db), null, 2));
    return 0;
  } finally {
    db.close();
  }
}

await runTool(async ([command, ...flags]) => {
  if (command === 'export' && flags.length === 0) return exportContent();
  if (command === 'apply' && flags.every((flag) => flag === '--yes' || flag === '--no-voice')) return apply(flags);
  throw new UsageError(USAGE);
});
