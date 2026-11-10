// The dry-run report of the question tool (doc 04, "questions.ts apply"): one German line per
// difference between the content before and after a change list.
import { describe, expect, it } from 'vitest';
import type { CountedOption, CountedQuestion, CountedTopic } from '../../shared/schema.ts';
import { describeChanges } from '../../server/domain/content-diff.ts';

function option(id: number, questionId: number, icon: string, label: string, more: Partial<CountedOption> = {}): CountedOption {
  return { id, questionId, label, icon, imageUrl: null, sort: 0, active: true, answerCount: 0, ...more };
}

function question(id: number, topicId: number, text: string, more: Partial<CountedQuestion> = {}): CountedQuestion {
  return {
    id,
    topicId,
    kind: 'scale5',
    multi: false,
    text,
    icon: '❓',
    imageUrl: null,
    audioUrl: null,
    frequency: 'core',
    sort: 0,
    active: true,
    answerCount: 0,
    options: [],
    ...more,
  };
}

function topic(id: number, name: string, questions: CountedQuestion[], more: Partial<CountedTopic> = {}): CountedTopic {
  return { id, name, color: '#f7a541', icon: '🍽️', imageUrl: null, sort: 0, active: true, answerCount: 0, questions, ...more };
}

const zeit = question(12, 1, 'Hattest du genug Zeit?', { kind: 'yesno' });
const laut = question(14, 1, 'Wie laut war es?', {
  kind: 'choice',
  options: [option(31, 14, '🤫', 'Leise'), option(32, 14, '📢', 'Laut')],
});
const BEFORE = [topic(1, 'Essen', [zeit, laut]), topic(4, 'Spielen & Basteln', [], { icon: '🎨', color: '#9b6fd6' })];

/** BEFORE with `change` applied to a deep copy. */
function after(change: (topics: CountedTopic[]) => void): CountedTopic[] {
  const copy = structuredClone(BEFORE);
  change(copy);
  return copy;
}

const q = (topics: CountedTopic[], id: number) => topics.flatMap((t) => t.questions).find((x) => x.id === id) as CountedQuestion;

describe('describeChanges (server/domain/content-diff.ts)', () => {
  it('reports nothing when nothing changed', () => {
    expect(describeChanges(BEFORE, structuredClone(BEFORE))).toEqual([]);
  });

  it('reports a reworded question with its topic', () => {
    const lines = describeChanges(BEFORE, after((t) => (q(t, 12).text = 'Hattest du heute genug Zeit?')));
    expect(lines).toEqual(['~ Frage 12 · Essen: „Hattest du genug Zeit?“ → „Hattest du heute genug Zeit?“']);
  });

  it('reports frequency, visibility, icon, order and kind changes, one line each', () => {
    const lines = describeChanges(
      BEFORE,
      after((t) => {
        Object.assign(q(t, 12), { frequency: 'extended', active: false, icon: '⏰', sort: 3, kind: 'scale3' });
      }),
    );
    expect(lines).toEqual([
      '~ Frage 12 · Essen: Art Ja/Nein → Skala 3',
      '~ Frage 12 · Essen: Symbol ❓ → ⏰',
      '~ Frage 12 · Essen: täglich → Sonderfrage',
      '~ Frage 12 · Essen: Reihenfolge 0 → 3',
      '~ Frage 12 · Essen: ausgeblendet',
    ]);
  });

  it('reports a question shown again and made daily', () => {
    const hidden = structuredClone(BEFORE);
    Object.assign(q(hidden, 12), { active: false, frequency: 'extended' });
    expect(describeChanges(hidden, structuredClone(BEFORE))).toEqual([
      '~ Frage 12 · Essen: Sonderfrage → täglich',
      '~ Frage 12 · Essen: wieder eingeblendet',
    ]);
  });

  it('reports a new question in one line with its kind, frequency and options', () => {
    const lines = describeChanges(
      BEFORE,
      after((t) => {
        t[1]?.questions.push(
          question(41, 4, 'Spielst du lieber drinnen oder draußen?', {
            kind: 'choice',
            frequency: 'extended',
            options: [option(50, 41, '🏠', 'Drinnen'), option(51, 41, '🌳', 'Draußen')],
          }),
        );
      }),
    );
    expect(lines).toEqual([
      '+ Frage 41 · Spielen & Basteln (Sonderfrage, Auswahl): „Spielst du lieber drinnen oder draußen?“ — 🏠 Drinnen · 🌳 Draußen',
    ]);
  });

  it('names a new multiple-choice question and a new hidden one as such', () => {
    const lines = describeChanges(
      BEFORE,
      after((t) => {
        t[1]?.questions.push(question(42, 4, 'Was machst du gern?', { kind: 'choice', multi: true, options: [option(52, 42, '🎨', 'Malen')] }));
        t[1]?.questions.push(question(43, 4, 'Wie war es?', { active: false }));
      }),
    );
    expect(lines).toEqual([
      '+ Frage 42 · Spielen & Basteln (täglich, Auswahl mehrfach): „Was machst du gern?“ — 🎨 Malen',
      '+ Frage 43 · Spielen & Basteln (täglich, Skala 5, ausgeblendet): „Wie war es?“',
    ]);
  });

  it('reports a deleted question', () => {
    const lines = describeChanges(BEFORE, after((t) => t[0]?.questions.splice(0, 1)));
    expect(lines).toEqual(['- Frage 12 · Essen: „Hattest du genug Zeit?“']);
  });

  it('reports new, changed, hidden and deleted options of an existing question', () => {
    const lines = describeChanges(
      BEFORE,
      after((t) => {
        const options = q(t, 14).options;
        options.splice(1, 1);
        Object.assign(options[0] as CountedOption, { label: 'Ganz leise', active: false });
        options.push(option(33, 14, '🙂', 'Mittel', { sort: 1 }));
      }),
    );
    expect(lines).toEqual([
      '~ Antwort 31 · Frage 14: „Leise“ → „Ganz leise“',
      '~ Antwort 31 · Frage 14: ausgeblendet',
      '+ Antwort 33 · Frage 14: 🙂 Mittel',
      '- Antwort 32 · Frage 14: „Laut“',
    ]);
  });

  it('reports topic changes and new and deleted topics', () => {
    const lines = describeChanges(
      BEFORE,
      after((t) => {
        Object.assign(t[0] as CountedTopic, { name: 'Mittagessen', color: '#e07a2f', active: false });
        t.splice(1, 1);
        t.push(topic(5, 'Musik', [question(60, 5, 'Hast du gesungen?', { kind: 'yesno' })], { icon: '🎵' }));
      }),
    );
    expect(lines).toEqual([
      '~ Thema 1: „Essen“ → „Mittagessen“',
      '~ Thema 1: Farbe #f7a541 → #e07a2f',
      '~ Thema 1: ausgeblendet',
      '+ Thema 5: 🎵 Musik',
      '+ Frage 60 · Musik (täglich, Ja/Nein): „Hast du gesungen?“',
      '- Thema 4: „Spielen & Basteln“',
    ]);
  });

  it('names the new topic name on the lines of its existing questions', () => {
    const lines = describeChanges(
      BEFORE,
      after((t) => {
        (t[0] as CountedTopic).name = 'Mittagessen';
        q(t, 12).text = 'Genug Zeit?';
      }),
    );
    expect(lines).toEqual(['~ Thema 1: „Essen“ → „Mittagessen“', '~ Frage 12 · Mittagessen: „Hattest du genug Zeit?“ → „Genug Zeit?“']);
  });

  it('reports a removed or changed picture without its file name', () => {
    const withPicture = structuredClone(BEFORE);
    q(withPicture, 12).imageUrl = `/media/${'a'.repeat(32)}.png`;
    expect(describeChanges(withPicture, structuredClone(BEFORE))).toEqual(['~ Frage 12 · Essen: Bild entfernt']);
    expect(describeChanges(BEFORE, withPicture)).toEqual(['~ Frage 12 · Essen: Bild geändert']);
  });
});
