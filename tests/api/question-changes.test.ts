// The question tool's batch (doc 04, "Question changes"): a dry run changes nothing, a commit is
// all or nothing, and every entry obeys the admin editor's rules.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentChangeList, type ContentChange, type CountedTopic } from '../../shared/schema.ts';
import { adminTopics } from '../../server/adapters/content-store.ts';
import { migrate, openDatabase, transaction, type Db } from '../../server/adapters/db.ts';
import { insertSubmission } from '../../server/adapters/submission-store.ts';
import { createCode, registerDevice } from '../../server/adapters/access-store.ts';
import { applyChanges, ChangeRefused } from '../../server/handlers/question-changes.ts';
import { fixture, THURSDAY } from './harness.ts';

const now = new Date(THURSDAY);
let db: Db;
let f: ReturnType<typeof fixture>;

beforeEach(async () => {
  db = openDatabase(':memory:');
  await migrate(db, null, now);
  f = fixture(db);
});
afterEach(() => db.close());

const deps = () => ({ db, now: () => now });
const content = (): CountedTopic[] => adminTopics(db);
const question = (id: number) => content().flatMap((t) => t.questions).find((q) => q.id === id);

/** Gives `taste` (scale5) and `likes` (choice: Nudeln) one real answer. */
function answerEssen(): void {
  const { device } = registerDevice(db, 'Tablet 1', now);
  const code = createCode(db, { animal: 'fuchs', color: 'blau', fruit: 'apfel', grade: 2, deviceId: device.id, createdAt: THURSDAY });
  if (code === 'taken') throw new Error('fixture code taken');
  const rows = [
    { questionId: f.taste.id, value: 4, optionId: null },
    { questionId: f.likes.id, value: null, optionId: f.pasta.id },
  ];
  insertSubmission(db, { codeId: code, topicId: f.essen.id, day: '2026-11-05', extended: false, createdAt: THURSDAY, rows });
}

const parse = (list: unknown[]): ContentChange[] => ContentChangeList.parse(list);

describe('applyChanges — dry run', () => {
  it('reports the differences and leaves the database as it was', () => {
    const before = content();
    const outcome = applyChanges(deps(), parse([{ op: 'question.update', id: f.taste.id, patch: { text: 'Wie hat es dir geschmeckt?', frequency: 'extended' } }]), false);
    expect(outcome.saved).toBe(false);
    expect(outcome.lines).toEqual([
      `~ Frage ${f.taste.id} · Essen: „Wie hat es geschmeckt?“ → „Wie hat es dir geschmeckt?“`,
      `~ Frage ${f.taste.id} · Essen: täglich → Sonderfrage`,
    ]);
    expect(content()).toEqual(before);
  });
});

describe('applyChanges — commit', () => {
  it('writes every entry and reports what changed', () => {
    const outcome = applyChanges(deps(), parse([{ op: 'question.update', id: f.quiet.id, patch: { active: false } }]), true);
    expect(outcome).toEqual({ saved: true, lines: [`~ Frage ${f.quiet.id} · Hausaufgaben: ausgeblendet`] });
    expect(question(f.quiet.id)?.active).toBe(false);
  });

  it('creates a question with its options in order, and lets later entries point at it by ref', () => {
    const outcome = applyChanges(
      deps(),
      parse([
        {
          op: 'question.create',
          ref: 'wo',
          topic: f.essen.id,
          question: { kind: 'choice', text: 'Wo isst du lieber?', icon: '🤔', frequency: 'extended', sort: 9 },
          options: [{ label: 'Drinnen', icon: '🏠' }, { label: 'Draußen', icon: '🌳', sort: 1 }],
        },
        { op: 'option.create', question: 'wo', option: { label: 'Egal', icon: '🤷', sort: 2 } },
      ]),
      true,
    );
    const created = content()[0]?.questions.find((q) => q.text === 'Wo isst du lieber?');
    expect(created?.frequency).toBe('extended');
    expect(created?.options.map((o) => o.label)).toEqual(['Drinnen', 'Draußen', 'Egal']);
    expect(outcome.lines).toEqual([`+ Frage ${created?.id} · Essen (Sonderfrage, Auswahl): „Wo isst du lieber?“ — 🏠 Drinnen · 🌳 Draußen · 🤷 Egal`]);
  });

  it('creates a topic and a question in it through a ref', () => {
    applyChanges(
      deps(),
      parse([
        { op: 'topic.create', ref: 'musik', topic: { name: 'Musik', color: '#9b6fd6', icon: '🎵', sort: 5 } },
        { op: 'question.create', topic: 'musik', question: { kind: 'yesno', text: 'Hast du heute gesungen?', icon: '🎤' } },
      ]),
      true,
    );
    const musik = content().find((t) => t.name === 'Musik');
    expect(musik?.questions.map((q) => q.text)).toEqual(['Hast du heute gesungen?']);
  });

  it('deletes an unanswered question inside the batch (its own transaction nests)', () => {
    applyChanges(deps(), parse([{ op: 'question.update', id: f.taste.id, patch: { icon: '😋' } }, { op: 'question.delete', id: f.enough.id }]), true);
    expect(question(f.enough.id)).toBeUndefined();
    expect(question(f.taste.id)?.icon).toBe('😋');
  });

  it('forces multi off when a question is not a choice', () => {
    applyChanges(deps(), parse([{ op: 'question.update', id: f.quiet.id, patch: { multi: true } }]), true);
    expect(question(f.quiet.id)?.multi).toBe(false);
  });
});

describe('applyChanges — refusals roll back the whole list', () => {
  function refused(list: unknown[]): string {
    const before = content();
    try {
      applyChanges(deps(), parse(list), true);
    } catch (err) {
      expect(err).toBeInstanceOf(ChangeRefused);
      expect(content()).toEqual(before);
      return (err as Error).message;
    }
    throw new Error('expected the change list to be refused');
  }

  it('keeps the kind of an answered question', () => {
    answerEssen();
    const message = refused([
      { op: 'question.update', id: f.quiet.id, patch: { text: 'Neu' } },
      { op: 'question.update', id: f.taste.id, patch: { kind: 'yesno' } },
    ]);
    expect(message).toBe(`Änderung 2 (question.update ${f.taste.id}): Die Art einer beantworteten Frage lässt sich nicht ändern — bitte eine neue Frage anlegen.`);
  });

  it('never deletes an answered question or a picked option', () => {
    answerEssen();
    expect(refused([{ op: 'question.delete', id: f.taste.id }])).toBe(
      `Änderung 1 (question.delete ${f.taste.id}): Diese Frage wurde schon beantwortet — bitte deaktivieren statt löschen.`,
    );
    expect(refused([{ op: 'option.delete', id: f.pasta.id }])).toBe(
      `Änderung 1 (option.delete ${f.pasta.id}): Diese Antwort wurde schon beantwortet — bitte deaktivieren statt löschen.`,
    );
  });

  it('refuses unknown ids', () => {
    expect(refused([{ op: 'question.update', id: 999, patch: { text: 'x' } }])).toBe('Änderung 1 (question.update 999): Diese Frage gibt es nicht.');
    expect(refused([{ op: 'option.create', question: 999, option: { label: 'x', icon: '❓' } }])).toBe('Änderung 1 (option.create): Diese Frage gibt es nicht.');
  });

  it('refuses an unknown or a repeated ref', () => {
    expect(refused([{ op: 'option.create', question: 'wo', option: { label: 'x', icon: '❓' } }])).toBe('Änderung 1 (option.create): Verweis „wo“ ist nicht bekannt.');
    const twice = { op: 'topic.create', ref: 'neu', topic: { name: 'Neu', color: '#9b6fd6', icon: '🆕' } };
    expect(refused([twice, twice])).toBe('Änderung 2 (topic.create): Verweis „neu“ gibt es schon.');
  });

  it('refuses options on a question that is not a choice', () => {
    expect(refused([{ op: 'option.create', question: f.taste.id, option: { label: 'x', icon: '❓' } }])).toBe(
      'Änderung 1 (option.create): Nur Auswahl-Fragen haben eigene Antworten.',
    );
  });
});

describe('ContentChangeList', () => {
  it('accepts only what the admin editor accepts', () => {
    expect(ContentChangeList.safeParse([{ op: 'question.update', id: 1, patch: { text: '' } }]).success).toBe(false);
    expect(ContentChangeList.safeParse([{ op: 'question.rename', id: 1 }]).success).toBe(false);
    expect(ContentChangeList.safeParse([{ op: 'question.update', id: 1, patch: { frequency: 'weekly' } }]).success).toBe(false);
    expect(ContentChangeList.safeParse([]).success).toBe(false);
    expect(ContentChangeList.safeParse([{ op: 'question.delete', id: 1 }]).success).toBe(true);
  });
});

describe('transaction()', () => {
  it('nests as a savepoint: an inner failure undoes only the inner work', () => {
    const add = (name: string) =>
      db.prepare("INSERT INTO topic (name, color, icon, sort, active, created_at) VALUES (?, '#000000', 'x', 0, 1, ?)").run(name, THURSDAY);
    transaction(db, () => {
      add('außen');
      expect(() =>
        transaction(db, () => {
          add('innen');
          throw new Error('inner');
        }),
      ).toThrow('inner');
    });
    const names = (db.prepare('SELECT name FROM topic').all() as { name: string }[]).map((r) => r.name);
    expect(names).toContain('außen');
    expect(names).not.toContain('innen');
    expect(db.isTransaction).toBe(false);
  });
});
