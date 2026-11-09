// Migration v3, the question update of 2026-11-09 (doc 01, "Starter content"): a v2 database with the
// old starter questions comes out with the revised ones; anything the admin edited is left alone.
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionKind } from '../../shared/catalog.ts';
import { insertOption, insertQuestion, insertTopic } from '../../server/adapters/content-write.ts';
import { migrate, openDatabase, schemaVersion, SCHEMA_VERSION, type Db } from '../../server/adapters/db.ts';
import { seedIfEmpty } from '../../server/seed.ts';
import { THURSDAY } from './harness.ts';

const now = new Date(THURSDAY);
type Row = { topic: string; text: string; frequency: string; sort: number; active: number };

let db: Db;
afterEach(() => db.close());

/** A database at v2 holding `topics` — the shape every install had before this update. */
async function v2With(topics: Record<string, [kind: QuestionKind, text: string, extended?: boolean][]>): Promise<Db> {
  const at = openDatabase(':memory:');
  await migrate(at, null, now);
  Object.entries(topics).forEach(([name, questions], ti) => {
    const topic = insertTopic(at, { name, color: '#f7a541', icon: '📚', imageUrl: null, sort: ti, active: true }, now);
    questions.forEach(([kind, text, extended], qi) => {
      const frequency = extended ? 'extended' : 'core';
      const q = insertQuestion(at, topic.id, { kind, multi: false, text, icon: '❓', imageUrl: null, audioUrl: null, frequency, sort: qi, active: true }, now);
      if (kind === 'choice') insertOption(at, q.id, { label: 'Nudeln', icon: '🍝', imageUrl: null, sort: 0, active: true });
    });
  });
  at.exec('PRAGMA user_version = 2');
  return at;
}

function questions(): Row[] {
  return db
    .prepare('SELECT t.name AS topic, q.text, q.frequency, q.sort, q.active FROM question q JOIN topic t ON t.id = q.topic_id ORDER BY t.sort, q.sort, q.id')
    .all() as Row[];
}

const active = (topic: string) => questions().filter((q) => q.topic === topic && q.active === 1).map((q) => q.text);

const OLD_STARTER = {
  Essen: [
    ['scale5', 'Wie hat dir das Essen heute geschmeckt?'],
    ['yesno', 'Bist du satt geworden?'],
    ['choice', 'Was isst du am liebsten?', true],
    ['yesno', 'Hattest du genug Zeit zum Essen?', true],
    ['choice', 'Wie laut war es beim Essen?', true],
  ],
  Hausaufgaben: [
    ['scale5', 'Wie gut konntest du heute deine Hausaufgaben machen?'],
    ['scale3', 'War es ruhig genug zum Arbeiten?', true],
  ],
  Miteinander: [
    ['scale5', 'Hast du dich heute wohlgefühlt?'],
    ['scale5', 'Haben dir die Erwachsenen heute zugehört?'],
    ['yesno', 'Hat dich heute jemand gelobt?', true],
  ],
  'Spielen & Basteln': [
    ['scale5', 'Wie hat dir heute gefallen, was du gemacht hast?'],
    ['choice', 'Was hast du heute gemacht?'],
    ['choice', 'Was möchtest du öfter machen?', true],
    ['scale3', 'Gibt es genug Spielsachen und Material?', true],
  ],
} satisfies Parameters<typeof v2With>[0];

describe('migration v3 — the questions of 2026-11-09', () => {
  it('brings the old starter questions to the revised ones', async () => {
    db = await v2With(OLD_STARTER);
    expect(await migrate(db, null, now)).toBe(2);
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(active('Essen')).toEqual(['Wie hat dir das Essen heute geschmeckt?', 'Bist du satt geworden?', 'Hattest du genug Zeit zum Essen?']);
    expect(questions().find((q) => q.text === 'Hattest du genug Zeit zum Essen?')?.frequency).toBe('core');
    expect(active('Hausaufgaben')).toEqual(['Wie gut konntest du heute in der Mittagsinsel deine Hausaufgaben machen?', 'War es ruhig genug zum Arbeiten?']);
    expect(active('Miteinander')).toEqual([
      'Hast du dich heute in der Mittagsinsel wohlgefühlt?',
      'Haben dir die Erwachsenen heute in der Mittagsinsel zugehört?',
      'Hat dich heute in der Mittagsinsel jemand gelobt?',
    ]);
    expect(active('Spielen & Basteln')).toEqual(['Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?', 'Spielst du lieber drinnen oder draußen?']);
  });

  it('switches dropped questions off instead of deleting them', async () => {
    db = await v2With(OLD_STARTER);
    await migrate(db, null, now);
    const off = questions().filter((q) => q.active === 0).map((q) => q.text);
    expect(off).toEqual([
      'Was isst du am liebsten?',
      'Wie laut war es beim Essen?',
      'Was hast du heute gemacht?',
      'Was möchtest du öfter machen?',
      'Gibt es genug Spielsachen und Material?',
    ]);
  });

  it('gives "drinnen oder draußen" its two options, once', async () => {
    db = await v2With(OLD_STARTER);
    await migrate(db, null, now);
    const options = db
      .prepare("SELECT o.label, o.icon FROM answer_option o JOIN question q ON q.id = o.question_id WHERE q.text = 'Spielst du lieber drinnen oder draußen?' ORDER BY o.sort")
      .all();
    expect(options).toEqual([{ label: 'Drinnen', icon: '🏠' }, { label: 'Draußen', icon: '🌳' }]);
  });

  it('leaves reworded questions alone, but not those in a renamed topic', async () => {
    db = await v2With({
      Mittagessen: [['choice', 'Was isst du am allerliebsten?', true], ['choice', 'Wie laut war es beim Essen?', true]],
      Miteinander: [['scale5', 'Hast du dich wohlgefühlt?']],
      Spielen: [['scale5', 'Wie hat dir heute gefallen, was du gemacht hast?']],
    });
    await migrate(db, null, now);
    expect(questions().map(({ topic, text, active: on }) => [topic, text, on])).toEqual([
      ['Mittagessen', 'Was isst du am allerliebsten?', 1],
      ['Mittagessen', 'Wie laut war es beim Essen?', 0],
      ['Miteinander', 'Hast du dich wohlgefühlt?', 1],
      ['Spielen', 'Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?', 1],
      ['Spielen', 'Spielst du lieber drinnen oder draußen?', 1],
    ]);
  });

  it('adds no second "drinnen oder draußen" when the admin already made one', async () => {
    db = await v2With({ Spielen: [['scale5', 'Wie hat dir heute gefallen, was du gemacht hast?'], ['choice', 'Spielst du lieber drinnen oder draußen?']] });
    await migrate(db, null, now);
    expect(questions().filter((q) => q.text === 'Spielst du lieber drinnen oder draußen?')).toHaveLength(1);
    expect(db.prepare('SELECT label FROM answer_option').all()).toEqual([{ label: 'Nudeln' }]);
  });

  it('seeds a fresh database straight with the revised questions', async () => {
    db = openDatabase(':memory:');
    await migrate(db, null, now);
    expect(seedIfEmpty(db, now)).toBe(true);
    expect(questions().every((q) => q.active === 1)).toBe(true);
    expect(active('Essen')).toHaveLength(3);
    expect(active('Spielen & Basteln')).toEqual(['Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?', 'Spielst du lieber drinnen oder draußen?']);
  });
});
