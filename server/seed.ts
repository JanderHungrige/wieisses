// Starter content (doc 01, "Starter content"): written once into an empty database. After that
// the topics belong to the admin and are never re-seeded or overwritten.
import type { QuestionKind } from '../shared/catalog.ts';
import { countTopics } from './adapters/content-store.ts';
import { insertOption, insertQuestion, insertTopic } from './adapters/content-write.ts';
import { transaction, type Db } from './adapters/db.ts';

type SeedOption = [icon: string, label: string];
type SeedQuestion = {
  kind: QuestionKind;
  text: string;
  icon: string;
  extended?: boolean;
  multi?: boolean;
  options?: SeedOption[];
};
type SeedTopic = { name: string; icon: string; color: string; questions: SeedQuestion[] };

const ACTIVITIES: SeedOption[] = [
  ['⚽', 'Draußen spielen'],
  ['✂️', 'Basteln'],
  ['🎨', 'Malen'],
  ['📖', 'Lesen'],
  ['🧱', 'Bauen'],
  ['🎲', 'Brettspiele'],
  ['🎵', 'Musik'],
  ['🛋️', 'Ausruhen'],
];

const STARTER: readonly SeedTopic[] = [
  {
    name: 'Essen',
    icon: '🍽️',
    color: '#f7a541',
    questions: [
      { kind: 'scale5', icon: '🍝', text: 'Wie hat dir das Essen heute geschmeckt?' },
      { kind: 'yesno', icon: '😋', text: 'Bist du satt geworden?' },
      { kind: 'yesno', icon: '⏰', text: 'Hattest du genug Zeit zum Essen?' },
      {
        kind: 'choice',
        multi: true,
        extended: true,
        icon: '🍴',
        text: 'Was isst du am liebsten?',
        options: [['🍝', 'Nudeln'], ['🍕', 'Pizza'], ['🍚', 'Reis'], ['🥔', 'Kartoffeln'], ['🥦', 'Gemüse'], ['🍎', 'Obst'], ['🐟', 'Fisch'], ['🍲', 'Suppe']],
      },
      {
        kind: 'choice',
        extended: true,
        icon: '👂',
        text: 'Wie laut war es beim Essen?',
        options: [['🤫', 'Leise'], ['🙂', 'Mittel'], ['📢', 'Laut']],
      },
    ],
  },
  {
    name: 'Hausaufgaben',
    icon: '📚',
    color: '#5aa9e6',
    questions: [
      { kind: 'scale5', icon: '✏️', text: 'Wie gut konntest du heute in der Mittagsinsel deine Hausaufgaben machen?' },
      {
        kind: 'choice',
        icon: '🙋',
        text: 'Hat dir jemand geholfen, wenn du Hilfe gebraucht hast?',
        options: [['👍', 'Ja'], ['👎', 'Nein'], ['💪', 'Ich brauchte keine Hilfe']],
      },
      { kind: 'scale3', extended: true, icon: '🤫', text: 'War es ruhig genug zum Arbeiten?' },
      { kind: 'yesno', extended: true, icon: '⏰', text: 'Hattest du genug Zeit für deine Hausaufgaben?' },
    ],
  },
  {
    name: 'Miteinander',
    icon: '🤝',
    color: '#4cc38a',
    questions: [
      { kind: 'scale5', icon: '💛', text: 'Hast du dich heute in der Mittagsinsel wohlgefühlt?' },
      { kind: 'scale5', icon: '👂', text: 'Haben dir die Erwachsenen heute in der Mittagsinsel zugehört?' },
      { kind: 'yesno', extended: true, icon: '🤗', text: 'Kannst du zu einem Erwachsenen gehen, wenn du traurig bist?' },
      { kind: 'scale3', extended: true, icon: '⚖️', text: 'Werden Streits bei uns fair gelöst?' },
      { kind: 'yesno', extended: true, icon: '⭐', text: 'Hat dich heute in der Mittagsinsel jemand gelobt?' },
    ],
  },
  {
    name: 'Spielen & Basteln',
    icon: '🎨',
    color: '#b388eb',
    questions: [
      { kind: 'scale5', icon: '🎈', text: 'Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?' },
      {
        kind: 'choice',
        icon: '🌤️',
        text: 'Warst du heute in der Mittagsinsel mehr draußen, drinnen oder etwa gleich?',
        options: [['🌳', 'Draußen'], ['🏠', 'Drinnen'], ['⚖️', 'Etwa gleich']],
      },
      { kind: 'choice', multi: true, extended: true, icon: '🧩', text: 'Was hast du heute in der Mittagsinsel gemacht?', options: ACTIVITIES },
      {
        kind: 'choice',
        multi: true,
        extended: true,
        icon: '🌟',
        text: 'Was möchtest du öfter machen?',
        options: [...ACTIVITIES, ['🧁', 'Kochen und Backen'], ['🏃', 'Sport'], ['🎭', 'Theater'], ['🚌', 'Ausflüge']],
      },
      { kind: 'scale3', extended: true, icon: '🧸', text: 'Gibt es genug Spielsachen und Material?' },
      {
        kind: 'choice',
        extended: true,
        icon: '🤔',
        text: 'Spielst du lieber drinnen oder draußen?',
        options: [['🏠', 'Drinnen'], ['🌳', 'Draußen']],
      },
    ],
  },
];

/** Seeds the starter topics into an empty database. Returns whether it did. */
export function seedIfEmpty(db: Db, now: Date): boolean {
  if (countTopics(db) > 0) return false;
  transaction(db, () => {
    STARTER.forEach((t, ti) => {
      const topic = insertTopic(db, { name: t.name, icon: t.icon, color: t.color, imageUrl: null, sort: ti, active: true }, now);
      t.questions.forEach((q, qi) => {
        const question = insertQuestion(
          db,
          topic.id,
          {
            kind: q.kind,
            multi: q.multi ?? false,
            text: q.text,
            icon: q.icon,
            imageUrl: null,
            audioUrl: null,
            frequency: q.extended ? 'extended' : 'core',
            sort: qi,
            active: true,
          },
          now,
        );
        (q.options ?? []).forEach(([icon, label], oi) => {
          insertOption(db, question.id, { label, icon, imageUrl: null, sort: oi, active: true });
        });
      });
    });
  });
  return true;
}
