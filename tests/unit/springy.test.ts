import { describe, it, expect } from 'vitest';
import { PHRASE, fixedPhrases } from '../../shared/phrases.ts';
import { spokenText, wantedTexts } from '../../server/domain/voice-texts.ts';
import { GREETING_MOVES, lookAt, nextMove, onLook, pupilOffset, springyMood, type Move, type Point } from '../../web/lib/springy.ts';

describe('Springy (web/lib/springy.ts)', () => {
  describe('springyMood', () => {
    it('greets on the start screen', () => {
      expect(springyMood('start')).toBe('hello');
    });

    it('is idle on every screen where a child answers', () => {
      for (const phase of ['ask', 'pick', 'unknown', 'welcome', 'topics'] as const) expect(springyMood(phase)).toBe('idle');
    });

    it('cheers on the thanks screen', () => {
      expect(springyMood('thanks')).toBe('cheer');
    });

    it('stays away from the adult screens', () => {
      for (const phase of ['loading', 'unregistered', 'offline'] as const) expect(springyMood(phase)).toBe('hidden');
    });
  });

  describe('nextMove', () => {
    it('has nine greeting moves: the original hop and eight new ones', () => {
      expect(new Set(GREETING_MOVES).size).toBe(9);
      expect(GREETING_MOVES[0]).toBe('hop');
    });

    it('never plays the same move twice in a row', () => {
      for (const previous of GREETING_MOVES) {
        for (const r of [0, 0.3, 0.5, 0.99, 0.999999]) expect(nextMove(previous, () => r)).not.toBe(previous);
      }
    });

    it('reaches every other move, and every move at the start', () => {
      const draws = (previous: Move | undefined) => new Set([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => nextMove(previous, () => i / 9)));
      expect(draws(undefined)).toEqual(new Set(GREETING_MOVES));
      expect(draws('spin')).toEqual(new Set(GREETING_MOVES.filter((m) => m !== 'spin')));
    });

    it('stays in range when random() returns its edges', () => {
      expect(GREETING_MOVES).toContain(nextMove('hop', () => 0));
      expect(GREETING_MOVES).toContain(nextMove('hop', () => 1));
    });
  });

  describe('pupilOffset', () => {
    it('turns the pupils towards a far target, never further than max', () => {
      const right = pupilOffset({ x: 0, y: 0 }, { x: 100, y: 0 }, 5);
      expect(right.x).toBeCloseTo(5);
      expect(right.y).toBeCloseTo(0);
      const downLeft = pupilOffset({ x: 0, y: 0 }, { x: -30, y: 40 }, 5);
      expect(downLeft.x).toBeCloseTo(-3);
      expect(downLeft.y).toBeCloseTo(4);
      expect(Math.hypot(downLeft.x, downLeft.y)).toBeCloseTo(5);
    });

    it('moves only as far as a near target', () => {
      expect(pupilOffset({ x: 10, y: 10 }, { x: 11, y: 12 }, 5)).toEqual({ x: 1, y: 2 });
    });

    it('looks straight ahead at its own eye or at a target that is not a number', () => {
      expect(pupilOffset({ x: 4, y: 4 }, { x: 4, y: 4 }, 5)).toEqual({ x: 0, y: 0 });
      expect(pupilOffset({ x: 0, y: 0 }, { x: Number.NaN, y: 3 }, 5)).toEqual({ x: 0, y: 0 });
      expect(pupilOffset({ x: 0, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 0 }, 5)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('lookAt / onLook', () => {
    it('tells every listener where a tapped 🔊 is, until it unsubscribes', () => {
      const first: Point[] = [];
      const second: Point[] = [];
      const offFirst = onLook((p) => first.push(p));
      const offSecond = onLook((p) => second.push(p));
      lookAt({ x: 120, y: 340 });
      offFirst();
      lookAt({ x: 5, y: 6 });
      offSecond();
      lookAt({ x: 7, y: 8 });
      expect(first).toEqual([{ x: 120, y: 340 }]);
      expect(second).toEqual([{ x: 120, y: 340 }, { x: 5, y: 6 }]);
    });
  });
});

describe('Springy in the voice (shared/phrases.ts, server/domain/voice-texts.ts)', () => {
  it('has its greeting as a fixed phrase, so the greeting gets a Thorsten clip', () => {
    expect(PHRASE.springyHello).toBe('Hallo, ich bin Springy!');
    expect(fixedPhrases()).toContain('Hallo, ich bin Springy!');
    expect(wantedTexts([])).toContain('Hallo, ich bin Springy!');
  });

  it('hands the voice the English reading of the name: the s joins the word before', () => {
    expect(spokenText('Hallo, ich bin Springy!')).toBe('Hallo, ich bins Pringy!');
    expect(spokenText('Frag mal Springy.')).toBe('Frag mals Pringy.');
  });

  it('leaves every other text as it is', () => {
    expect(spokenText('Wie hat es geschmeckt?')).toBe('Wie hat es geschmeckt?');
    expect(spokenText('Springy hilft dir.')).toBe('Springy hilft dir.');
    expect(spokenText('Das ist Springyland.')).toBe('Das ist Springyland.');
    expect(spokenText('Wir springen!')).toBe('Wir springen!');
  });
});
