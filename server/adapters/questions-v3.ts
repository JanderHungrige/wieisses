// Migration v3, the question update of 2026-11-09 (doc 01, "Starter content"): brings an existing
// database to the revised starter questions once. It matches questions by their old starter text
// alone — a renamed topic does not stop it — so only what the admin reworded stays as it is.
// Nothing is switched off or deleted.

const str = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const PLAY = 'Wie hat dir heute gefallen, was du gemacht hast?';
const PLAY_NOW = 'Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?';
const DONE_NOW = 'Was hast du heute in der Mittagsinsel gemacht?';

const MITTAGSINSEL: readonly [from: string, to: string][] = [
  ['Wie gut konntest du heute deine Hausaufgaben machen?', 'Wie gut konntest du heute in der Mittagsinsel deine Hausaufgaben machen?'],
  ['Hast du dich heute wohlgefühlt?', 'Hast du dich heute in der Mittagsinsel wohlgefühlt?'],
  ['Haben dir die Erwachsenen heute zugehört?', 'Haben dir die Erwachsenen heute in der Mittagsinsel zugehört?'],
  ['Hat dich heute jemand gelobt?', 'Hat dich heute in der Mittagsinsel jemand gelobt?'],
  [PLAY, PLAY_NOW],
  ['Was hast du heute gemacht?', DONE_NOW],
];

type NewChoice = { text: string; icon: string; frequency: 'core' | 'extended'; sort: string; options: readonly [icon: string, label: string][] };

/** `sort` is SQL over the "gefallen" question's row (`g`). */
const NEW_CHOICES: readonly NewChoice[] = [
  {
    text: 'Warst du heute in der Mittagsinsel mehr draußen, drinnen oder etwa gleich?',
    icon: '🌤️',
    frequency: 'core',
    sort: 'g.sort', // same sort, higher id: right after "gefallen"
    options: [['🌳', 'Draußen'], ['🏠', 'Drinnen'], ['⚖️', 'Etwa gleich']],
  },
  {
    text: 'Spielst du lieber drinnen oder draußen?',
    icon: '🤔',
    frequency: 'extended',
    sort: '(SELECT MAX(sort) + 1 FROM question WHERE topic_id = g.topic_id)',
    options: [['🏠', 'Drinnen'], ['🌳', 'Draußen']],
  },
];

// Into the topic of the "gefallen" question, wherever the admin has put or named it; one INSERT for
// all options, so they go in only if the question has none yet.
const addChoice = ({ text, icon, frequency, sort, options }: NewChoice): string => `
  INSERT INTO question (topic_id, kind, multi, text, icon, image_url, audio_url, frequency, sort, active, created_at)
    SELECT g.topic_id, 'choice', 0, ${str(text)}, ${str(icon)}, NULL, NULL, '${frequency}', ${sort}, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM question g WHERE g.text = ${str(PLAY_NOW)}
      AND NOT EXISTS (SELECT 1 FROM question WHERE text = ${str(text)})
    ORDER BY g.id LIMIT 1;
  INSERT INTO answer_option (question_id, label, icon, image_url, sort, active)
    SELECT q.id, v.label, v.icon, NULL, v.sort, 1
    FROM question q, (${options.map(([i, label], n) => `SELECT ${str(label)} AS label, ${str(i)} AS icon, ${n} AS sort`).join(' UNION ALL ')}) v
    WHERE q.text = ${str(text)} AND NOT EXISTS (SELECT 1 FROM answer_option o WHERE o.question_id = q.id);`;

export const QUESTIONS_V3 = [
  ...MITTAGSINSEL.map(([from, to]) => `UPDATE question SET text = ${str(to)} WHERE text = ${str(from)};`),
  `UPDATE question SET frequency = 'core' WHERE text = ${str('Hattest du genug Zeit zum Essen?')};`,
  `UPDATE question SET frequency = 'extended' WHERE text = ${str(DONE_NOW)};`,
  ...NEW_CHOICES.map(addChoice),
].join('\n');
