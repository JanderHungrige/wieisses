// Fixed vocabularies shared by server and web: the picture-code alphabet and the answer
// faces of the built-in question kinds (doc 01, "Answer catalogue" and "Picture code alphabet").

export type Picture = { readonly id: string; readonly emoji: string; readonly name: string };
export type Colour = { readonly id: string; readonly name: string; readonly hex: string };

export const ANIMALS = Object.freeze([
  { id: 'fuchs', emoji: '🦊', name: 'Fuchs' },
  { id: 'hund', emoji: '🐶', name: 'Hund' },
  { id: 'katze', emoji: '🐱', name: 'Katze' },
  { id: 'hase', emoji: '🐰', name: 'Hase' },
  { id: 'baer', emoji: '🐻', name: 'Bär' },
  { id: 'panda', emoji: '🐼', name: 'Panda' },
  { id: 'frosch', emoji: '🐸', name: 'Frosch' },
  { id: 'loewe', emoji: '🦁', name: 'Löwe' },
  { id: 'affe', emoji: '🐵', name: 'Affe' },
  { id: 'pinguin', emoji: '🐧', name: 'Pinguin' },
  { id: 'schildkroete', emoji: '🐢', name: 'Schildkröte' },
  { id: 'eule', emoji: '🦉', name: 'Eule' },
] as const satisfies readonly Picture[]);

export const COLOURS = Object.freeze([
  { id: 'rot', name: 'Rot', hex: '#e53935' },
  { id: 'blau', name: 'Blau', hex: '#1e88e5' },
  { id: 'gruen', name: 'Grün', hex: '#43a047' },
  { id: 'gelb', name: 'Gelb', hex: '#fdd835' },
  { id: 'lila', name: 'Lila', hex: '#8e24aa' },
  { id: 'orange', name: 'Orange', hex: '#fb8c00' },
  { id: 'rosa', name: 'Rosa', hex: '#f48fb1' },
  { id: 'braun', name: 'Braun', hex: '#8d6e63' },
] as const satisfies readonly Colour[]);

export const FRUITS = Object.freeze([
  { id: 'apfel', emoji: '🍎', name: 'Apfel' },
  { id: 'banane', emoji: '🍌', name: 'Banane' },
  { id: 'erdbeere', emoji: '🍓', name: 'Erdbeere' },
  { id: 'trauben', emoji: '🍇', name: 'Trauben' },
  { id: 'birne', emoji: '🍐', name: 'Birne' },
  { id: 'kirschen', emoji: '🍒', name: 'Kirschen' },
  { id: 'zitrone', emoji: '🍋', name: 'Zitrone' },
  { id: 'melone', emoji: '🍉', name: 'Melone' },
] as const satisfies readonly Picture[]);

export type AnimalId = (typeof ANIMALS)[number]['id'];
export type ColourId = (typeof COLOURS)[number]['id'];
export type FruitId = (typeof FRUITS)[number]['id'];
export type CodePicks = { animal: AnimalId; color: ColourId; fruit: FruitId };

export const ANIMAL_IDS = ANIMALS.map((a) => a.id) as [AnimalId, ...AnimalId[]];
export const COLOUR_IDS = COLOURS.map((c) => c.id) as [ColourId, ...ColourId[]];
export const FRUIT_IDS = FRUITS.map((f) => f.id) as [FruitId, ...FruitId[]];

export function animal(id: string): Picture | undefined {
  return ANIMALS.find((a) => a.id === id);
}

export function colour(id: string): Colour | undefined {
  return COLOURS.find((c) => c.id === id);
}

export function fruit(id: string): Picture | undefined {
  return FRUITS.find((f) => f.id === id);
}

/** "Fuchs, Blau, Apfel" — how a code is read aloud and shown to adults. */
export function spokenCode(code: CodePicks): string {
  return [animal(code.animal)?.name, colour(code.color)?.name, fruit(code.fruit)?.name]
    .filter((part): part is string => part !== undefined)
    .join(', ');
}

export const QUESTION_KINDS = ['scale5', 'scale3', 'yesno', 'choice'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export type ScaleKind = Exclude<QuestionKind, 'choice'>;

export type Face = { readonly value: number; readonly emoji: string; readonly label: string; readonly tint: string };

/** Built-in answers, best first — the order the kiosk shows them in. */
export const FACES: Readonly<Record<ScaleKind, readonly Face[]>> = Object.freeze({
  scale5: Object.freeze([
    { value: 5, emoji: '😄', label: 'Super', tint: '#c8f0d2' },
    { value: 4, emoji: '🙂', label: 'Gut', tint: '#e2f5c4' },
    { value: 3, emoji: '😐', label: 'Geht so', tint: '#fff2b8' },
    { value: 2, emoji: '🙁', label: 'Nicht so gut', tint: '#ffdcb8' },
    { value: 1, emoji: '😢', label: 'Schlecht', tint: '#ffc9c9' },
  ]),
  scale3: Object.freeze([
    { value: 3, emoji: '😄', label: 'Gut', tint: '#c8f0d2' },
    { value: 2, emoji: '😐', label: 'Geht so', tint: '#fff2b8' },
    { value: 1, emoji: '🙁', label: 'Nicht gut', tint: '#ffc9c9' },
  ]),
  yesno: Object.freeze([
    { value: 1, emoji: '👍', label: 'Ja', tint: '#c8f0d2' },
    { value: 0, emoji: '👎', label: 'Nein', tint: '#ffc9c9' },
  ]),
});

/** Highest value of a scale kind; yesno is not a scale and has none. */
export const SCALE_MAX: Readonly<Record<'scale5' | 'scale3', number>> = Object.freeze({ scale5: 5, scale3: 3 });

export function isScale(kind: QuestionKind): kind is 'scale5' | 'scale3' {
  return kind === 'scale5' || kind === 'scale3';
}

/** Suggested tab colours for the admin's colour picker (dark text stays readable on all). */
export const TOPIC_COLOURS = Object.freeze([
  '#f7a541', '#5aa9e6', '#4cc38a', '#b388eb', '#f28fb6', '#f6d155', '#4fc9c4', '#ef7f6f',
] as const);
