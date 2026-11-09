// Migration v3, the question update of 2026-11-09 (doc 01, "Starter content"): a v2 database with the
// old starter questions comes out with the revised ones; anything the admin reworded is left alone.
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionKind } from '../../shared/catalog.ts';
import { insertOption, insertQuestion, insertTopic } from '../../server/adapters/content-write.ts';
import { migrate, openDatabase, schemaVersion, SCHEMA_VERSION, type Db } from '../../server/adapters/db.ts';
import { seedIfEmpty } from '../../server/seed.ts';
import { THURSDAY } from './harness.ts';

const now = new Date(THURSDAY);
const OUTSIDE_TODAY = 'Warst du heute in der Mittagsinsel mehr draußen, drinnen oder etwa gleich?';
const OUTSIDE_RATHER = 'Spielst du lieber drinnen oder draußen?';
type Row = { topic: string; text: string; frequency: string; active: number };

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
    .prepare('SELECT t.name AS topic, q.text, q.frequency, q.active FROM question q JOIN topic t ON t.id = q.topic_id ORDER BY t.sort, q.sort, q.id')
    .all() as Row[];
}

/** The topic's questions in kiosk order, as "core: …" / "extended: …". */
const shown = (topic: string) => questions().filter((q) => q.topic === topic).map((q) => `${q.frequency}: ${q.text}`);

const optionsOf = (text: string) =>
  db.prepare('SELECT o.icon, o.label FROM answer_option o JOIN question q ON q.id = o.question_id WHERE q.text = ? ORDER BY o.sort').all(text);

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
    expect(shown('Essen')).toEqual([
      'core: Wie hat dir das Essen heute geschmeckt?',
      'core: Bist du satt geworden?',
      'extended: Was isst du am liebsten?',
      'core: Hattest du genug Zeit zum Essen?',
      'extended: Wie laut war es beim Essen?',
    ]);
    expect(shown('Hausaufgaben')).toEqual(['core: Wie gut konntest du heute in der Mittagsinsel deine Hausaufgaben machen?', 'extended: War es ruhig genug zum Arbeiten?']);
    expect(shown('Miteinander')).toEqual([
      'core: Hast du dich heute in der Mittagsinsel wohlgefühlt?',
      'core: Haben dir die Erwachsenen heute in der Mittagsinsel zugehört?',
      'extended: Hat dich heute in der Mittagsinsel jemand gelobt?',
    ]);
    expect(shown('Spielen & Basteln')).toEqual([
      'core: Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?',
      `core: ${OUTSIDE_TODAY}`,
      'extended: Was hast du heute in der Mittagsinsel gemacht?',
      'extended: Was möchtest du öfter machen?',
      'extended: Gibt es genug Spielsachen und Material?',
      `extended: ${OUTSIDE_RATHER}`,
    ]);
  });

  it('switches nothing off', async () => {
    db = await v2With(OLD_STARTER);
    await migrate(db, null, now);
    expect(questions().every((q) => q.active === 1)).toBe(true);
  });

  it('gives the two new questions their options, once', async () => {
    db = await v2With(OLD_STARTER);
    await migrate(db, null, now);
    expect(optionsOf(OUTSIDE_TODAY)).toEqual([
      { icon: '🌳', label: 'Draußen' },
      { icon: '🏠', label: 'Drinnen' },
      { icon: '⚖️', label: 'Etwa gleich' },
    ]);
    expect(optionsOf(OUTSIDE_RATHER)).toEqual([{ icon: '🏠', label: 'Drinnen' }, { icon: '🌳', label: 'Draußen' }]);
  });

  it('leaves reworded questions alone, but not those in a renamed topic', async () => {
    db = await v2With({
      Mittagessen: [['choice', 'Was isst du am allerliebsten?', true], ['yesno', 'Hattest du genug Zeit zum Essen?', true]],
      Miteinander: [['scale5', 'Hast du dich wohlgefühlt?']],
      Spielen: [['scale5', 'Wie hat dir heute gefallen, was du gemacht hast?']],
    });
    await migrate(db, null, now);
    expect(shown('Mittagessen')).toEqual(['extended: Was isst du am allerliebsten?', 'core: Hattest du genug Zeit zum Essen?']);
    expect(shown('Miteinander')).toEqual(['core: Hast du dich wohlgefühlt?']);
    expect(shown('Spielen')).toEqual([
      'core: Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?',
      `core: ${OUTSIDE_TODAY}`,
      `extended: ${OUTSIDE_RATHER}`,
    ]);
  });

  it('adds no new question when the admin already made one with that text', async () => {
    db = await v2With({ Spielen: [['scale5', 'Wie hat dir heute gefallen, was du gemacht hast?'], ['choice', OUTSIDE_RATHER]] });
    await migrate(db, null, now);
    expect(questions().filter((q) => q.text === OUTSIDE_RATHER)).toHaveLength(1);
    expect(optionsOf(OUTSIDE_RATHER)).toEqual([{ icon: '🍝', label: 'Nudeln' }]);
  });

  it('adds nothing when the "gefallen" question was reworded', async () => {
    db = await v2With({ Spielen: [['scale5', 'Wie war dein Tag?']] });
    await migrate(db, null, now);
    expect(shown('Spielen')).toEqual(['core: Wie war dein Tag?']);
  });

  it('seeds a fresh database straight with the revised questions', async () => {
    db = openDatabase(':memory:');
    await migrate(db, null, now);
    expect(seedIfEmpty(db, now)).toBe(true);
    expect(shown('Essen').filter((q) => q.startsWith('core'))).toHaveLength(3);
    expect(shown('Spielen & Basteln')).toEqual([
      'core: Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?',
      `core: ${OUTSIDE_TODAY}`,
      'extended: Was hast du heute in der Mittagsinsel gemacht?',
      'extended: Was möchtest du öfter machen?',
      'extended: Gibt es genug Spielsachen und Material?',
      `extended: ${OUTSIDE_RATHER}`,
    ]);
  });
});
