// The question tool's report (doc 04, "questions.ts apply"): what differs between the content
// before and after a change list, one German line per difference — `+` new, `-` gone, `~` changed.
// Pure; topics and questions are matched by id.
import type { QuestionKind } from '../../shared/catalog.ts';
import type { CountedOption, CountedQuestion, CountedTopic } from '../../shared/schema.ts';

const KIND: Readonly<Record<QuestionKind, string>> = Object.freeze({
  scale5: 'Skala 5',
  scale3: 'Skala 3',
  yesno: 'Ja/Nein',
  choice: 'Auswahl',
});

const quoted = (text: string) => `„${text}“`;
const frequency = (q: CountedQuestion) => (q.frequency === 'extended' ? 'Sonderfrage' : 'täglich');
const shown = (active: boolean) => (active ? 'wieder eingeblendet' : 'ausgeblendet');

function media(name: string, before: string | null, after: string | null): string[] {
  if (before === after) return [];
  return [`${name} ${after === null ? 'entfernt' : 'geändert'}`];
}

function renamed(before: string, after: string): string[] {
  return before === after ? [] : [`${quoted(before)} → ${quoted(after)}`];
}

function changed<T>(name: string, before: T, after: T, show: (value: T) => string = String): string[] {
  return before === after ? [] : [`${name} ${show(before)} → ${show(after)}`];
}

function byId<T extends { id: number }>(items: readonly T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function optionList(options: readonly CountedOption[]): string {
  return options.map((o) => `${o.icon} ${o.label}${o.active ? '' : ' (ausgeblendet)'}`).join(' · ');
}

function newQuestion(q: CountedQuestion, topic: string): string {
  const kind = q.kind === 'choice' && q.multi ? `${KIND.choice} mehrfach` : KIND[q.kind];
  const traits = [frequency(q), kind, ...(q.active ? [] : ['ausgeblendet'])].join(', ');
  const options = q.options.length > 0 ? ` — ${optionList(q.options)}` : '';
  return `+ Frage ${q.id} · ${topic} (${traits}): ${quoted(q.text)}${options}`;
}

function optionChanges(before: CountedQuestion, after: CountedQuestion): string[] {
  const old = byId(before.options);
  const lines = after.options.flatMap((o) => {
    const was = old.get(o.id);
    if (!was) return [`+ Antwort ${o.id} · Frage ${after.id}: ${o.icon} ${o.label}`];
    const diffs = [
      ...renamed(was.label, o.label),
      ...changed('Symbol', was.icon, o.icon),
      ...media('Bild', was.imageUrl, o.imageUrl),
      ...changed('Reihenfolge', was.sort, o.sort),
      ...(was.active === o.active ? [] : [shown(o.active)]),
    ];
    return diffs.map((d) => `~ Antwort ${o.id} · Frage ${after.id}: ${d}`);
  });
  const kept = new Set(after.options.map((o) => o.id));
  const gone = before.options.filter((o) => !kept.has(o.id)).map((o) => `- Antwort ${o.id} · Frage ${after.id}: ${quoted(o.label)}`);
  return [...lines, ...gone];
}

function questionChanges(before: CountedQuestion, after: CountedQuestion, topic: string): string[] {
  const diffs = [
    ...renamed(before.text, after.text),
    ...changed('Art', before.kind, after.kind, (k) => KIND[k]),
    ...(before.multi === after.multi ? [] : [`Mehrfachauswahl ${after.multi ? 'an' : 'aus'}`]),
    ...changed('Symbol', before.icon, after.icon),
    ...media('Bild', before.imageUrl, after.imageUrl),
    ...media('Ton', before.audioUrl, after.audioUrl),
    ...(before.frequency === after.frequency ? [] : [`${frequency(before)} → ${frequency(after)}`]),
    ...changed('Reihenfolge', before.sort, after.sort),
    ...(before.active === after.active ? [] : [shown(after.active)]),
  ];
  return [...diffs.map((d) => `~ Frage ${after.id} · ${topic}: ${d}`), ...optionChanges(before, after)];
}

function topicChanges(before: CountedTopic, after: CountedTopic): string[] {
  const diffs = [
    ...renamed(before.name, after.name),
    ...changed('Symbol', before.icon, after.icon),
    ...changed('Farbe', before.color, after.color),
    ...media('Bild', before.imageUrl, after.imageUrl),
    ...changed('Reihenfolge', before.sort, after.sort),
    ...(before.active === after.active ? [] : [shown(after.active)]),
  ];
  return diffs.map((d) => `~ Thema ${after.id}: ${d}`);
}

/** One line per difference, in the order of `after`: each topic, then its questions and options. */
export function describeChanges(before: readonly CountedTopic[], after: readonly CountedTopic[]): string[] {
  const oldTopics = byId(before);
  const oldQuestions = byId(before.flatMap((t) => t.questions));
  const keptQuestions = new Set(after.flatMap((t) => t.questions.map((q) => q.id)));
  const lines = after.flatMap((topic) => {
    const was = oldTopics.get(topic.id);
    if (!was) return [`+ Thema ${topic.id}: ${topic.icon} ${topic.name}`, ...topic.questions.map((q) => newQuestion(q, topic.name))];
    const questions = topic.questions.flatMap((q) => {
      const old = oldQuestions.get(q.id);
      return old ? questionChanges(old, q, topic.name) : [newQuestion(q, topic.name)];
    });
    const gone = was.questions.filter((q) => !keptQuestions.has(q.id)).map((q) => `- Frage ${q.id} · ${topic.name}: ${quoted(q.text)}`);
    return [...topicChanges(was, topic), ...questions, ...gone];
  });
  const keptTopics = new Set(after.map((t) => t.id));
  return [...lines, ...before.filter((t) => !keptTopics.has(t.id)).map((t) => `- Thema ${t.id}: ${quoted(t.name)}`)];
}
