// Fills a DEV database with eight weeks of plausible answers so the dashboard has something to
// show. Never run against production.
//   DATA_DIR=.data node dev/demo-answers.ts
import { join } from 'node:path';
import { ANIMALS, COLOURS, FRUITS } from '../shared/catalog.ts';
import { createCode, registerDevice } from '../server/adapters/access-store.ts';
import { questionsForCheck, kioskTopics } from '../server/adapters/content-store.ts';
import { openDatabase } from '../server/adapters/db.ts';
import { insertSubmission } from '../server/adapters/submission-store.ts';
import { addDays, berlinDay, isExtendedDay, isoWeekday } from '../server/domain/day.ts';
import type { AnswerRow } from '../server/domain/answers.ts';

const dir = process.env.DATA_DIR;
if (!dir || process.env.APP_ENV === 'prod') throw new Error('set DATA_DIR to a dev data directory');
const db = openDatabase(join(dir, 'wieisses.sqlite'));
let seed = 42;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;

const { device } = registerDevice(db, 'Demo-Tablet', new Date());
const codes: number[] = [];
for (let i = 0; codes.length < 45 && i < 500; i++) {
  const id = createCode(db, { animal: pick(ANIMALS).id, color: pick(COLOURS).id, fruit: pick(FRUITS).id, grade: 1 + Math.floor(rand() * 4), deviceId: device.id, createdAt: new Date().toISOString() });
  if (id !== 'taken') codes.push(id);
}

const today = berlinDay(new Date());
const mood = (day: string) => 0.55 + 0.25 * Math.sin(Number(day.slice(8, 10)) / 5); // drifts over weeks
let made = 0;
for (let back = 56; back >= 1; back--) {
  const day = addDays(today, -back);
  if (isoWeekday(day) > 5) continue;
  const extended = isExtendedDay(day, [5]);
  for (const topic of kioskTopics(db, extended)) {
    const questions = questionsForCheck(db, topic.id).filter((q) => q.active && (q.frequency === 'core' || extended));
    for (const code of codes) {
      if (rand() > 0.35) continue;
      const rows: AnswerRow[] = questions.flatMap((q): AnswerRow[] => {
        const good = rand() < mood(day) + (topic.id % 3) * 0.05;
        if (q.kind === 'scale5') return [{ questionId: q.id, value: good ? pick([4, 5, 5]) : pick([1, 2, 3, 3]), optionId: null }];
        if (q.kind === 'scale3') return [{ questionId: q.id, value: good ? pick([2, 3, 3]) : pick([1, 2]), optionId: null }];
        if (q.kind === 'yesno') return [{ questionId: q.id, value: good ? 1 : pick([0, 1]), optionId: null }];
        const options = q.options.filter((o) => o.active);
        const chosen = [...new Set([pick(options), ...(q.multi && rand() < 0.5 ? [pick(options)] : [])])];
        return chosen.map((o) => ({ questionId: q.id, value: null, optionId: o.id }));
      });
      if (insertSubmission(db, { codeId: code, topicId: topic.id, day, extended, createdAt: `${day}T12:00:00Z`, rows }) === 'ok') made++;
    }
  }
}
console.log(`demo: ${codes.length} codes, ${made} submissions`);
db.close();
