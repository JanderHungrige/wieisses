// One question in the editor: collapsed as a row, expanded as a form with picture, recording,
// "Probe vorlesen" and — for picture choices — its answer options.
import { useState } from 'preact/hooks';
import type { QuestionKind } from '../../../shared/catalog.ts';
import type { AdminQuestion } from '../../../shared/schema.ts';
import { initSpeech, sayQuestion } from '../../lib/speech.ts';
import { adminApi } from '../adminApi.ts';
import { MediaField, Status, message, reorder } from '../fields.tsx';

const KINDS: Record<QuestionKind, string> = { scale5: '5 Smileys', scale3: '3 Smileys', yesno: 'Ja / Nein', choice: 'Bilder-Auswahl' };

type Props = { question: AdminQuestion; index: number; siblings: AdminQuestion[]; onChanged: () => void };

export function QuestionEditor({ question: q, index, siblings, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(q);
  const [status, setStatus] = useState<string | null>(null);
  const set = (patch: Partial<AdminQuestion>) => setDraft({ ...draft, ...patch });

  async function run(work: () => Promise<unknown>, done: string): Promise<void> {
    try {
      await work();
      setStatus(`✓ ${done}`);
      onChanged();
    } catch (err) {
      setStatus(message(err));
    }
  }

  const save = (e: Event) => {
    e.preventDefault();
    const { text, icon, kind, multi, frequency, active, imageUrl, audioUrl } = draft;
    const json = { text, icon, multi, frequency, active, imageUrl, audioUrl, ...(kind !== q.kind ? { kind } : {}) };
    void run(() => adminApi(`/api/v1/admin/questions/${q.id}`, { method: 'PATCH', json }), 'Frage gespeichert');
  };
  const move = (step: -1 | 1) => run(() => reorder(siblings, index, step, (id) => `/api/v1/admin/questions/${id}`), 'Reihenfolge gespeichert');
  const remove = () => {
    if (window.confirm('Diese Frage löschen?')) void run(() => adminApi(`/api/v1/admin/questions/${q.id}`, { method: 'DELETE' }), 'Frage gelöscht');
  };

  return (
    <li class={q.active ? 'question-item' : 'question-item inactive'}>
      <div class="question-row">
        <span class="q-icon" aria-hidden="true">{q.icon}</span>
        <span class="q-text">{q.text}</span>
        <span class="badge">{KINDS[q.kind]}</span>
        <span class={q.frequency === 'core' ? 'badge core' : 'badge extended'}>{q.frequency === 'core' ? 'Kern' : 'ausführlich'}</span>
        {!q.active && <span class="badge">inaktiv</span>}
        <span class="muted">{q.answerCount} Antw.</span>
        <button type="button" class="ghost" aria-expanded={open} onClick={() => (setDraft(q), setOpen(!open))}>{open ? 'Schließen' : 'Bearbeiten'}</button>
      </div>
      {open && (
        <form class="form-grid question-form" onSubmit={save}>
          <label class="wide">Frage (wird vorgelesen)<textarea rows={2} maxLength={200} required value={draft.text} onInput={(e) => set({ text: e.currentTarget.value })} /></label>
          <label>Symbol (Emoji)<input value={draft.icon} maxLength={16} required onInput={(e) => set({ icon: e.currentTarget.value })} /></label>
          <label>
            Art
            <select value={draft.kind} disabled={q.answerCount > 0} onChange={(e) => set({ kind: e.currentTarget.value as QuestionKind })}>
              {Object.entries(KINDS).map(([value, label]) => <option value={value}>{label}</option>)}
            </select>
          </label>
          {draft.kind === 'choice' && (
            <label class="check-label"><input type="checkbox" checked={draft.multi} onChange={(e) => set({ multi: e.currentTarget.checked })} /> mehrere Antworten erlaubt</label>
          )}
          <label>
            Wann
            <select value={draft.frequency} onChange={(e) => set({ frequency: e.currentTarget.value === 'extended' ? 'extended' : 'core' })}>
              <option value="core">Kern – jeden Tag</option>
              <option value="extended">ausführlich – nur an ausgewählten Tagen</option>
            </select>
          </label>
          <label class="check-label"><input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.currentTarget.checked })} /> aktiv</label>
          <MediaField label="Bild (statt Emoji)" kind="image" url={draft.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
          <MediaField label="Eigene Aufnahme (statt Computerstimme)" kind="audio" url={draft.audioUrl} onChange={(audioUrl) => set({ audioUrl })} />
          <div class="actions wide">
            <button type="submit" class="primary">Speichern</button>
            <button type="button" class="ghost" onClick={() => (initSpeech(0.9), sayQuestion(draft.text, draft.audioUrl))}>🔊 Probe vorlesen</button>
            <button type="button" class="ghost" disabled={index === 0} onClick={() => void move(-1)}>↑</button>
            <button type="button" class="ghost" disabled={index === siblings.length - 1} onClick={() => void move(1)}>↓</button>
            {q.answerCount === 0 && <button type="button" class="danger" onClick={remove}>Löschen</button>}
          </div>
          {q.kind === 'choice' && <OptionsEditor question={q} onChanged={onChanged} />}
        </form>
      )}
      <Status text={status} />
    </li>
  );
}

function OptionsEditor({ question, onChanged }: { question: AdminQuestion; onChanged: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const run = (work: () => Promise<unknown>, done: string) =>
    work().then(
      () => (setStatus(`✓ ${done}`), onChanged()),
      (err: unknown) => setStatus(message(err)),
    );
  const patch = (id: number, json: Record<string, unknown>) => run(() => adminApi(`/api/v1/admin/options/${id}`, { method: 'PATCH', json }), 'Antwort gespeichert');
  const options = question.options;

  return (
    <fieldset class="wide options-editor">
      <legend>Antworten zum Antippen</legend>
      {options.map((o, i) => (
        <div class={o.active ? 'option-row' : 'option-row inactive'}>
          <input aria-label="Symbol" class="icon-input" value={o.icon} maxLength={16} onChange={(e) => void patch(o.id, { icon: e.currentTarget.value })} />
          <input aria-label="Antwort" value={o.label} maxLength={40} onChange={(e) => void patch(o.id, { label: e.currentTarget.value })} />
          <label class="check-label"><input type="checkbox" checked={o.active} onChange={(e) => void patch(o.id, { active: e.currentTarget.checked })} /> aktiv</label>
          <button type="button" class="ghost" aria-label="nach oben" disabled={i === 0} onClick={() => void run(() => reorder(options, i, -1, (id) => `/api/v1/admin/options/${id}`), 'Reihenfolge gespeichert')}>↑</button>
          <button type="button" class="ghost" aria-label="nach unten" disabled={i === options.length - 1} onClick={() => void run(() => reorder(options, i, 1, (id) => `/api/v1/admin/options/${id}`), 'Reihenfolge gespeichert')}>↓</button>
          {o.answerCount === 0 && (
            <button type="button" class="danger" onClick={() => void run(() => adminApi(`/api/v1/admin/options/${o.id}`, { method: 'DELETE' }), 'Antwort gelöscht')}>Löschen</button>
          )}
        </div>
      ))}
      <button type="button" class="ghost" onClick={() => void run(() => adminApi(`/api/v1/admin/questions/${question.id}/options`, { json: { label: 'Neue Antwort', icon: '⭐', sort: options.length } }), 'Antwort angelegt')}>
        + Antwort
      </button>
      <Status text={status} />
    </fieldset>
  );
}
