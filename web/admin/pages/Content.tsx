// The question editor: tabs (topics) on the left, the chosen topic and its questions on the right.
// Answered items can only be deactivated, never deleted (doc 01, "Admin").
import { useEffect, useState } from 'preact/hooks';
import { TOPIC_COLOURS, type QuestionKind } from '../../../shared/catalog.ts';
import type { AdminTopic, Topic } from '../../../shared/schema.ts';
import { adminApi, useLoad } from '../adminApi.ts';
import { Status, message, reorder } from '../fields.tsx';
import { QuestionEditor } from './QuestionEditor.tsx';

export function Content({ selectedId }: { selectedId: number | null }) {
  const { data: topics, error, reload } = useLoad<AdminTopic[]>('/api/v1/admin/topics');
  const selected = topics?.find((t) => t.id === selectedId) ?? topics?.[0];

  async function addTopic(): Promise<void> {
    const list = topics ?? [];
    const colour = TOPIC_COLOURS[list.length % TOPIC_COLOURS.length] ?? '#f7a541';
    const made = await adminApi<Topic>('/api/v1/admin/topics', { json: { name: 'Neues Thema', icon: '⭐', color: colour, sort: list.length } });
    reload();
    window.location.hash = `#/fragen/${made.id}`;
  }

  return (
    <>
      <div class="page-head">
        <h1>Fragen</h1>
      </div>
      {error && <p class="error" role="alert">{error}</p>}
      <div class="split">
        <nav class="card topic-list" aria-label="Themen">
          {topics?.map((t) => (
            <a href={`#/fragen/${t.id}`} aria-current={t.id === selected?.id ? 'page' : undefined}>
              <span class="swatch" style={{ background: t.color }} aria-hidden="true" />
              {t.icon} {t.name}
              {!t.active && <span class="badge">inaktiv</span>}
            </a>
          ))}
          <button type="button" class="ghost" onClick={() => void addTopic()}>+ Neues Thema</button>
        </nav>
        {selected && topics && <TopicEditor key={selected.id} topic={selected} topics={topics} reload={reload} />}
      </div>
    </>
  );
}

function TopicEditor({ topic, topics, reload }: { topic: AdminTopic; topics: AdminTopic[]; reload: () => void }) {
  const [draft, setDraft] = useState({ name: topic.name, icon: topic.icon, color: topic.color, active: topic.active });
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setDraft({ name: topic.name, icon: topic.icon, color: topic.color, active: topic.active }), [topic]);

  async function run(work: () => Promise<unknown>, done: string): Promise<void> {
    try {
      await work();
      setStatus(`✓ ${done}`);
      reload();
    } catch (err) {
      setStatus(message(err));
    }
  }

  const index = topics.findIndex((t) => t.id === topic.id);
  const save = (e: Event) => {
    e.preventDefault();
    void run(() => adminApi(`/api/v1/admin/topics/${topic.id}`, { method: 'PATCH', json: draft }), 'Thema gespeichert');
  };
  const remove = () => {
    if (!window.confirm(`Thema „${topic.name}“ mit allen Fragen löschen?`)) return;
    void run(async () => {
      await adminApi(`/api/v1/admin/topics/${topic.id}`, { method: 'DELETE' });
      window.location.hash = '#/fragen';
    }, 'Thema gelöscht');
  };
  const addQuestion = (kind: QuestionKind) =>
    run(
      () => adminApi(`/api/v1/admin/topics/${topic.id}/questions`, { json: { kind, text: 'Neue Frage', icon: '❓', sort: topic.questions.length, multi: false } }),
      'Frage angelegt',
    );

  return (
    <section class="card editor" aria-labelledby="topic-edit">
      <h2 id="topic-edit">Thema bearbeiten</h2>
      <form class="form-grid" onSubmit={save}>
        <label>Name<input value={draft.name} maxLength={40} required onInput={(e) => setDraft({ ...draft, name: e.currentTarget.value })} /></label>
        <label>Symbol (Emoji)<input value={draft.icon} maxLength={16} required onInput={(e) => setDraft({ ...draft, icon: e.currentTarget.value })} /></label>
        <label>
          Farbe
          <span class="colour-row">
            <input type="color" value={draft.color} onInput={(e) => setDraft({ ...draft, color: e.currentTarget.value })} />
            {TOPIC_COLOURS.map((c) => (
              <button type="button" class="colour-chip" style={{ background: c }} aria-label={`Farbe ${c}`} onClick={() => setDraft({ ...draft, color: c })} />
            ))}
          </span>
        </label>
        <label class="check-label"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.currentTarget.checked })} /> aktiv (auf den Tablets sichtbar)</label>
        <div class="actions">
          <button type="submit" class="primary">Speichern</button>
          <button type="button" class="ghost" disabled={index <= 0} onClick={() => void run(() => reorder(topics, index, -1, (id) => `/api/v1/admin/topics/${id}`), 'Reihenfolge gespeichert')}>↑ nach vorn</button>
          <button type="button" class="ghost" disabled={index >= topics.length - 1} onClick={() => void run(() => reorder(topics, index, 1, (id) => `/api/v1/admin/topics/${id}`), 'Reihenfolge gespeichert')}>↓ nach hinten</button>
          {topic.answerCount === 0 ? (
            <button type="button" class="danger" onClick={remove}>Löschen</button>
          ) : (
            <span class="muted">{topic.answerCount} Abgaben – nur deaktivieren möglich</span>
          )}
        </div>
      </form>
      <Status text={status} />
      <h2>Fragen</h2>
      <p class="muted">„Kern“-Fragen kommen jeden Tag, „ausführliche“ nur an den Wochentagen aus den Einstellungen.</p>
      <ol class="question-list">
        {topic.questions.map((q, i) => (
          <QuestionEditor key={q.id} question={q} index={i} siblings={topic.questions} onChanged={reload} />
        ))}
      </ol>
      <div class="actions">
        <span>Neue Frage:</span>
        <button type="button" class="ghost" onClick={() => void addQuestion('scale5')}>5 Smileys</button>
        <button type="button" class="ghost" onClick={() => void addQuestion('scale3')}>3 Smileys</button>
        <button type="button" class="ghost" onClick={() => void addQuestion('yesno')}>Ja / Nein</button>
        <button type="button" class="ghost" onClick={() => void addQuestion('choice')}>Bilder-Auswahl</button>
      </div>
    </section>
  );
}
