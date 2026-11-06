// The question editor: tabs (topics) on the left, the chosen topic and its questions on the right,
// the Thorsten voice on top and "Speichern & vertonen" at the bottom. Field edits are drafts until
// that one save; adding, deleting and reordering happen at once (doc 01, "Voice (Thorsten)").
import { useState } from 'preact/hooks';
import { TOPIC_COLOURS } from '../../../shared/catalog.ts';
import type { AdminTopic, Topic } from '../../../shared/schema.ts';
import { adminApi, useLoad } from '../adminApi.ts';
import { drafts, useDrafts } from '../drafts.ts';
import { Status, message } from '../fields.tsx';
import { TopicEditor } from './TopicEditor.tsx';
import { VoicePanel, startVoicing, useVoiceStatus } from './VoicePanel.tsx';

export type Voice = ReturnType<typeof useVoiceStatus>;

export function Content({ selectedId }: { selectedId: number | null }) {
  const { data: topics, error, reload } = useLoad<AdminTopic[]>('/api/v1/admin/topics');
  const voice = useVoiceStatus(reload);
  const pending = useDrafts();
  const selected = topics?.find((t) => t.id === selectedId) ?? topics?.[0];

  async function addTopic(): Promise<void> {
    const list = topics ?? [];
    const colour = TOPIC_COLOURS[list.length % TOPIC_COLOURS.length] ?? '#f7a541';
    const made = await adminApi<Topic>('/api/v1/admin/topics', { json: { name: 'Neues Thema', icon: '⭐', color: colour, sort: list.length } });
    reload();
    window.location.hash = `#/fragen/${made.id}`;
  }

  const touched = (t: AdminTopic) =>
    drafts.isChanged('topic', t.id) ||
    t.questions.some((q) => drafts.isChanged('question', q.id) || q.options.some((o) => drafts.isChanged('option', o.id)));

  return (
    <>
      <div class="page-head">
        <h1>Fragen</h1>
      </div>
      <VoicePanel status={voice.status} refresh={voice.refresh} />
      {error && <p class="error" role="alert">{error}</p>}
      <div class="split">
        <nav class="card topic-list" aria-label="Themen">
          {topics?.map((t) => {
            const view = drafts.view('topic', t.id, t);
            return (
              <a href={`#/fragen/${t.id}`} aria-current={t.id === selected?.id ? 'page' : undefined}>
                <span class="swatch" style={{ background: view.color }} aria-hidden="true" />
                {view.icon} {view.name}
                {!view.active && <span class="badge">inaktiv</span>}
                {touched(t) && <span class="badge changed">geändert</span>}
              </a>
            );
          })}
          <button type="button" class="ghost" onClick={() => void addTopic()}>+ Neues Thema</button>
        </nav>
        {selected && topics && <TopicEditor key={selected.id} topic={selected} topics={topics} voice={voice} reload={reload} />}
      </div>
      <SaveBar pending={pending} voice={voice} onSaved={reload} />
    </>
  );
}

function SaveBar({ pending, voice, onSaved }: { pending: number; voice: Voice; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const voiced = voice.status?.configured ?? false;

  async function save(): Promise<void> {
    setBusy(true);
    try {
      const saved = await drafts.saveAll();
      if (voiced) await startVoicing('missing');
      setStatus(`✓ ${saved} Änderung${saved === 1 ? '' : 'en'} gespeichert${voiced ? ' – die Stimme wird jetzt erzeugt' : ''}`);
    } catch (err) {
      setStatus(`${message(err)} — die übrigen Änderungen sind noch nicht gespeichert.`);
    } finally {
      setBusy(false);
      onSaved();
      voice.refresh();
    }
  }

  const discard = () => {
    if (window.confirm(`${pending} ungespeicherte Änderung${pending === 1 ? '' : 'en'} verwerfen?`)) drafts.clear();
  };

  return (
    <div class="save-bar" role="region" aria-label="Änderungen speichern">
      <p class="save-count">{pending === 0 ? 'Alles gespeichert' : `${pending} ungespeicherte Änderung${pending === 1 ? '' : 'en'}`}</p>
      <Status text={status} />
      <div class="actions">
        <button type="button" class="ghost" disabled={pending === 0 || busy} onClick={discard}>Verwerfen</button>
        <button type="button" class="primary" disabled={pending === 0 || busy} onClick={() => void save()}>
          {voiced ? 'Speichern & vertonen' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
