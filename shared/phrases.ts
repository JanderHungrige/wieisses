// Every fixed sentence the kiosk speaks (doc 01, "Fixed kiosk phrases"). Screens and the server's
// child-facing messages use these constants, so a spoken text and its Thorsten clip always match.
import { ANIMALS, COLOURS, FACES, FRUITS } from './catalog.ts';

export const PHRASE = Object.freeze({
  springyHello: 'Hallo, ich bin Springy!',
  askSign: 'Hast du schon ein Geheimzeichen?',
  haveSign: 'Ja, ich habe eins',
  newHere: 'Ich bin neu',
  pickAnimalNew: 'Such dir ein Tier aus!',
  pickColourNew: 'Jetzt eine Farbe!',
  pickFruitNew: 'Und jetzt ein Obst!',
  pickGrade: 'In welche Klasse gehst du?',
  pickAnimal: 'Welches Tier ist in deinem Geheimzeichen?',
  pickColour: 'Welche Farbe?',
  pickFruit: 'Welches Obst?',
  newSign: 'Das ist jetzt dein Geheimzeichen:',
  remember: 'Merk es dir gut!',
  unknownSign: 'Das Zeichen kenne ich nicht. Probier es nochmal!',
  retry: 'Nochmal',
  signTaken: 'Dieses Zeichen hat schon jemand. Such dir ein anderes aus!',
  pauseGuess: 'Kurze Pause! Gleich kannst du es nochmal probieren.',
  pauseNew: 'Kurze Pause! Gleich kannst du ein Zeichen aussuchen.',
  chooseTopic: 'Worüber möchtest du erzählen?',
  alreadyDone: 'Das hast du heute schon gemacht. Morgen wieder!',
  thanks: 'Danke!',
  allDone: 'Alles geschafft! Danke und tschüss!',
  bye: 'Tschüss!',
  skip: 'Überspringen',
  done: 'Fertig',
} as const);

export const GRADES_SPOKEN = Object.freeze([1, 2, 3, 4, 5, 6] as const);

export function gradePhrase(grade: number): string {
  return `Klasse ${grade}`;
}

/** The form a text is keyed and looked up in: trimmed, inner whitespace collapsed. */
export function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** All fixed phrases, normalised and without duplicates (face labels repeat across kinds). */
export function fixedPhrases(): string[] {
  const all = [
    ...Object.values(PHRASE),
    ...ANIMALS.map((a) => a.name),
    ...COLOURS.map((c) => c.name),
    ...FRUITS.map((f) => f.name),
    ...Object.values(FACES).flatMap((faces) => faces.map((face) => face.label)),
    ...GRADES_SPOKEN.map(gradePhrase),
  ];
  return [...new Set(all.map(normaliseText))];
}
