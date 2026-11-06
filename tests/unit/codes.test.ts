import { describe, it, expect } from 'vitest';
import { ANIMALS, COLOURS, FRUITS, spokenCode } from '../../shared/catalog.ts';
import { CodePicksSchema, NewCodeSchema } from '../../shared/schema.ts';

describe('Picture code alphabet (shared/catalog.ts, shared/schema.ts)', () => {
  it('has 12 animals, 8 colours and 8 fruits — 768 combinations — with unique ids', () => {
    expect(ANIMALS).toHaveLength(12);
    expect(COLOURS).toHaveLength(8);
    expect(FRUITS).toHaveLength(8);
    expect(ANIMALS.length * COLOURS.length * FRUITS.length).toBe(768);
    for (const list of [ANIMALS, COLOURS, FRUITS]) {
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
    expect(Object.isFrozen(ANIMALS)).toBe(true);
  });

  it('accepts a code whose three parts are all in the alphabet', () => {
    expect(CodePicksSchema.safeParse({ animal: 'fuchs', color: 'blau', fruit: 'apfel' }).success).toBe(true);
    expect(NewCodeSchema.safeParse({ animal: 'eule', color: 'braun', fruit: 'melone', grade: 3 }).success).toBe(true);
  });

  it('rejects a code with an unknown animal, colour or fruit', () => {
    expect(CodePicksSchema.safeParse({ animal: 'drache', color: 'blau', fruit: 'apfel' }).success).toBe(false);
    expect(CodePicksSchema.safeParse({ animal: 'fuchs', color: 'schwarz', fruit: 'apfel' }).success).toBe(false);
    expect(CodePicksSchema.safeParse({ animal: 'fuchs', color: 'blau', fruit: 'karotte' }).success).toBe(false);
    expect(NewCodeSchema.safeParse({ animal: 'fuchs', color: 'blau', fruit: 'apfel', grade: 7 }).success).toBe(false);
  });

  it('speaks a code as "Fuchs, Blau, Apfel"', () => {
    expect(spokenCode({ animal: 'fuchs', color: 'blau', fruit: 'apfel' })).toBe('Fuchs, Blau, Apfel');
    expect(spokenCode({ animal: 'schildkroete', color: 'gruen', fruit: 'kirschen' })).toBe('Schildkröte, Grün, Kirschen');
  });
});
