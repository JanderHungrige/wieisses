// One topic in the editor: its fields (drafts), order, delete, and its questions.
import { useState } from 'preact/hooks';
import { TOPIC_COLOURS, type QuestionKind } from '../../../shared/catalog.ts';
import type { AdminTopic } from '../../../shared/schema.ts';
import { adminApi } from '../adminApi.ts';
import { drafts, useDrafts } from '../drafts.ts';
import { Status, message, reorder } from '../fields.tsx';
import type { Voice } from './Content.tsx';
import { QuestionEditor } from './QuestionEditor.tsx';
import { VoiceLine } from './VoicePanel.tsx';

type Props = { topic: AdminTopic; topics: AdminTopic[]; voice: Voice; reload: () => void };

export function TopicEditor({ topic, topics, voice, reload }: Props) {
  useDrafts();
  const [status, setStatus] = useState<string | null>(null);
  const view = drafts.view('topic', topic.id, { name: topic.name, icon: topic.icon, color: topic.color, active: topic.active });
  const set = (patch: Partial<typeof view>) => drafts.edit('topic', topic.id, patch);
  const index = topics.findIndex((t) => t.id === topic.id);

  async function run(work: () => Promise<unknown>, done: string): Promise<void> {
    try {
      await work();
      setStatus(`✓ ${done}`);
      reload();
    } catch (err) {
      setStatus(message(err));
    }
  }

  const move = (step: -1 | 1) => run(() => reorder(topics, index, step, (id) => `/api/v1/admin/topics/${id}`), 'Reihenfolge gespeichert');
  const remove = () => {
    if (!window.confirm(`Thema „${topic.name}“ mit allen Fragen löschen?`)) return;
    void run(async () => {
      await adminApi(`/api/v1/admin/topics/${topic.id}`, { method: 'DELETE' });
      drafts.forget('topic', topic.id);
      window.location.hash = '#/fragen';
    }, 'Thema gelöscht');
  };
  const addQuestion = (kind: QuestionKind) =>
    run(
      () => adminApi(`/api/v1/admin/topics/${topic.id}/questions`, { json: { kind, text: 'Neue Frage', icon: '❓', sort: topic.questions.length, multi: false } }),
      'Frage angelegt – Text eingeben, dann unten speichern',
    );

  return (
    <section class="card editor" aria-labelledby="topic-edit">
      <h2 id="topic-edit">Thema bearbeiten {drafts.isChanged('topic', topic.id) && <span class="badge changed">geändert</span>}</h2>
      <div class="form-grid">
        <label>Name (wird vorgelesen)<input value={view.name} maxLength={40} required onInput={(e) => set({ name: e.currentTarget.value })} /></label>
        <label>Symbol (Emoji)<input value={view.icon} maxLength={16} required onInput={(e) => set({ icon: e.currentTarget.value })} /></label>
        <label>
          Farbe
          <span class="colour-row">
            <input type="color" value={view.color} onInput={(e) => set({ color: e.currentTarget.value })} />
            {TOPIC_COLOURS.map((c) => (
              <button type="button" class="colour-chip" style={{ background: c }} aria-label={`Farbe ${c}`} onClick={() => set({ color: c })} />
            ))}
          </span>
        </label>
        <label class="check-label"><input type="checkbox" checked={view.active} onChange={(e) => set({ active: e.currentTarget.checked })} /> aktiv (auf den Tablets sichtbar)</label>
        <div class="wide">
          <VoiceLine text={view.name} savedText={topic.name} voiceUrl={topic.voiceUrl} status={voice.status} onRevoiced={voice.refresh} />
        </div>
        <div class="actions">
          <button type="button" class="ghost" disabled={index <= 0} onClick={() => void move(-1)}>↑ nach vorn</button>
          <button type="button" class="ghost" disabled={index >= topics.length - 1} onClick={() => void move(1)}>↓ nach hinten</button>
          {topic.answerCount === 0 ? (
            <button type="button" class="danger" onClick={remove}>Löschen</button>
          ) : (
            <span class="muted">{topic.answerCount} Abgaben – nur deaktivieren möglich</span>
          )}
        </div>
      </div>
      <Status text={status} />
      <h2>Fragen</h2>
      <p class="muted">„Kern“-Fragen kommen jeden Tag, „ausführliche“ nur an den Wochentagen aus den Einstellungen.</p>
      <ol class="question-list">
        {topic.questions.map((q, i) => (
          <QuestionEditor key={q.id} question={q} index={i} siblings={topic.questions} voice={voice} onChanged={reload} />
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
