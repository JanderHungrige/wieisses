// Demo answers for showing the dashboard (doc 04, "Demo data"), run inside the app container or
// against a dev data directory (DATA_DIR=.data):
//   node server/ops/demo.ts add [--seed n] | remove | status
// Exit 0 done, 1 refused (a set exists already), 2 bad usage.
import { addDemo, demoStatus, removeDemo, type DemoSummary } from '../handlers/demo.ts';
import { openLiveDatabase, runTool, UsageError } from './cli.ts';

const USAGE = 'usage: demo.ts add [--seed n] | demo.ts remove | demo.ts status';
const NONE = 'Keine Beispieldaten vorhanden.';
const say = (line: string) => process.stdout.write(`${line}\n`);
const summaryLine = (s: DemoSummary) => `Beispieldaten: ${s.codes} Bildzeichen, ${s.submissions} Antworten (${s.from ?? '–'} bis ${s.to ?? '–'}).`;

function seedOf(flags: readonly string[]): number | undefined {
  if (flags.length === 0) return undefined;
  const seed = Number(flags[1]);
  if (flags[0] !== '--seed' || flags.length !== 2 || !Number.isInteger(seed) || seed < 1) throw new UsageError(USAGE);
  return seed;
}

await runTool(async ([command, ...flags]) => {
  if (command !== 'add' && flags.length > 0) throw new UsageError(USAGE);
  const seed = command === 'add' ? seedOf(flags) : undefined;
  const db = openLiveDatabase();
  try {
    switch (command) {
      case 'add': {
        const added = addDemo({ db, now: () => new Date() }, { seed });
        if (added === 'exists') {
          say('Beispieldaten gibt es schon — erst „remove“.');
          return 1;
        }
        say(summaryLine(added));
        return 0;
      }
      case 'remove': {
        const removed = removeDemo(db);
        say(removed === 'none' ? NONE : `Entfernt: ${removed.codes} Bildzeichen, ${removed.submissions} Antworten.`);
        return 0;
      }
      case 'status': {
        const status = demoStatus(db);
        say(status ? summaryLine(status) : NONE);
        return 0;
      }
      default:
        throw new UsageError(USAGE);
    }
  } finally {
    db.close();
  }
});
