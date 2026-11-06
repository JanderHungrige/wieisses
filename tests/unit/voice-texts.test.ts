import { describe, it, expect } from 'vitest';
import { ANIMALS, COLOURS, FRUITS } from '../../shared/catalog.ts';
import { PHRASE, fixedPhrases, normaliseText } from '../../shared/phrases.ts';
import { clipKey, lengthScaleFor, wantedTexts, type ContentForVoice } from '../../server/domain/voice-texts.ts';

const content: ContentForVoice = [
  {
    name: 'Essen',
    active: true,
    questions: [
      { text: 'Wie hat es geschmeckt?', active: true, options: [] },
      { text: 'Was magst du?', active: true, options: [{ label: 'Nudeln', active: true }, { label: 'Pizza', active: false }] },
      { text: 'Alte Frage', active: false, options: [{ label: 'Weg', active: true }] },
    ],
  },
  { name: 'Ferien', active: false, questions: [{ text: 'Wohin fährst du?', active: true, options: [] }] },
  { name: '  Essen ', active: true, questions: [{ text: 'Danke!', active: true, options: [] }] },
];

describe('Voice texts (server/domain/voice-texts.ts, shared/phrases.ts)', () => {
  describe('normaliseText', () => {
    it('trims and collapses inner whitespace, keeps case and punctuation', () => {
      expect(normaliseText('  Wie   hat es\n dir geschmeckt? ')).toBe('Wie hat es dir geschmeckt?');
      expect(normaliseText('Danke!')).toBe('Danke!');
      expect(normaliseText('   ')).toBe('');
    });
  });

  describe('clipKey', () => {
    it('is a 64-hex sha256 that stays the same for the same text, voice and lengthScale', () => {
      const key = clipKey('Danke!', 1.11);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(clipKey('Danke!', 1.11)).toBe(key);
    });

    it('changes when the text or the lengthScale changes, not when only whitespace does', () => {
      const key = clipKey('Danke!', 1.11);
      expect(clipKey('Danke', 1.11)).not.toBe(key);
      expect(clipKey('Danke!', 1)).not.toBe(key);
      expect(clipKey('  Danke! ', 1.11)).toBe(key);
    });
  });

  describe('lengthScaleFor', () => {
    it('is 1 / speechRate rounded to two decimals', () => {
      expect(lengthScaleFor(0.9)).toBe(1.11);
      expect(lengthScaleFor(1)).toBe(1);
      expect(lengthScaleFor(0.6)).toBe(1.67);
      expect(lengthScaleFor(1.3)).toBe(0.77);
    });
  });

  describe('fixed phrases', () => {
    it('contain every animal, colour and fruit name, every face label and "Klasse 1" … "Klasse 6"', () => {
      const fixed = fixedPhrases();
      for (const item of [...ANIMALS, ...COLOURS, ...FRUITS]) expect(fixed).toContain(item.name);
      for (const label of ['Super', 'Gut', 'Geht so', 'Nicht so gut', 'Schlecht', 'Nicht gut', 'Ja', 'Nein']) expect(fixed).toContain(label);
      for (const g of [1, 2, 3, 4, 5, 6]) expect(fixed).toContain(`Klasse ${g}`);
      expect(new Set(fixed).size).toBe(fixed.length);
    });

    it('contain the server messages a child hears (code taken, pauses, already answered)', () => {
      const fixed = fixedPhrases();
      for (const text of [PHRASE.signTaken, PHRASE.pauseGuess, PHRASE.pauseNew, PHRASE.alreadyDone, PHRASE.unknownSign]) expect(fixed).toContain(text);
    });
  });

  describe('wantedTexts', () => {
    it('is the fixed phrases plus active topic names, question texts and option labels, without duplicates', () => {
      const wanted = wantedTexts(content);
      for (const text of ['Essen', 'Wie hat es geschmeckt?', 'Was magst du?', 'Nudeln']) expect(wanted).toContain(text);
      expect(wanted.filter((t) => t === 'Essen')).toHaveLength(1);
      expect(wanted.filter((t) => t === 'Danke!')).toHaveLength(1);
      expect(wanted.length).toBe(fixedPhrases().length + 4);
    });

    it('leaves out inactive topics, questions and options', () => {
      const wanted = wantedTexts(content);
      for (const text of ['Pizza', 'Alte Frage', 'Weg', 'Ferien', 'Wohin fährst du?']) expect(wanted).not.toContain(text);
    });
  });
});
