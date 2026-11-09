// Migration v3, the question update of 2026-11-09 (doc 01, "Starter content"): brings an existing
// database to the revised starter questions once. It matches questions by their old starter text
// alone — a renamed topic does not stop it — so only what the admin reworded stays as it is.

const str = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const PLAY = 'Wie hat dir heute gefallen, was du gemacht hast?';
const PLAY_NOW = 'Wie hat dir heute in der Mittagsinsel gefallen, was du gemacht hast?';

const MITTAGSINSEL: readonly [from: string, to: string][] = [
  ['Wie gut konntest du heute deine Hausaufgaben machen?', 'Wie gut konntest du heute in der Mittagsinsel deine Hausaufgaben machen?'],
  ['Hast du dich heute wohlgefühlt?', 'Hast du dich heute in der Mittagsinsel wohlgefühlt?'],
  ['Haben dir die Erwachsenen heute zugehört?', 'Haben dir die Erwachsenen heute in der Mittagsinsel zugehört?'],
  ['Hat dich heute jemand gelobt?', 'Hat dich heute in der Mittagsinsel jemand gelobt?'],
  [PLAY, PLAY_NOW],
];

/** Switched off, never deleted, so their answers stay in the results. */
const DROPPED: readonly string[] = [
  'Was isst du am liebsten?',
  'Wie laut war es beim Essen?',
  'Was hast du heute gemacht?',
  'Was möchtest du öfter machen?',
  'Gibt es genug Spielsachen und Material?',
];

const INSIDE_OUTSIDE = 'Spielst du lieber drinnen oder draußen?';
const INSIDE_OUTSIDE_OPTIONS: readonly [icon: string, label: string][] = [
  ['🏠', 'Drinnen'],
  ['🌳', 'Draußen'],
];

// Into the topic of the "gefallen" question, wherever the admin has put or named it; one INSERT for
// both options, so they go in only if the question has none yet.
const addInsideOutside = `
  INSERT INTO question (topic_id, kind, multi, text, icon, image_url, audio_url, frequency, sort, active, created_at)
    SELECT topic_id, 'choice', 0, ${str(INSIDE_OUTSIDE)}, '🤔', NULL, NULL, 'core', sort + 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM question WHERE text = ${str(PLAY_NOW)}
      AND NOT EXISTS (SELECT 1 FROM question WHERE text = ${str(INSIDE_OUTSIDE)})
    ORDER BY id LIMIT 1;
  INSERT INTO answer_option (question_id, label, icon, image_url, sort, active)
    SELECT q.id, v.label, v.icon, NULL, v.sort, 1
    FROM question q, (${INSIDE_OUTSIDE_OPTIONS.map(([icon, label], sort) => `SELECT ${str(label)} AS label, ${str(icon)} AS icon, ${sort} AS sort`).join(' UNION ALL ')}) v
    WHERE q.text = ${str(INSIDE_OUTSIDE)} AND NOT EXISTS (SELECT 1 FROM answer_option o WHERE o.question_id = q.id);
`;

export const QUESTIONS_V3 = [
  ...MITTAGSINSEL.map(([from, to]) => `UPDATE question SET text = ${str(to)} WHERE text = ${str(from)};`),
  `UPDATE question SET frequency = 'core' WHERE text = ${str('Hattest du genug Zeit zum Essen?')};`,
  ...DROPPED.map((text) => `UPDATE question SET active = 0 WHERE text = ${str(text)};`),
  addInsideOutside,
].join('\n');
