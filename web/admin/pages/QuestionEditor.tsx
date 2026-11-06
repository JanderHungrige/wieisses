// One question in the editor: collapsed as a row, expanded as a form with picture, recording and —
// for picture choices — its answer options. Field edits are drafts until "Speichern & vertonen".
import { useState } from 'preact/hooks';
import type { QuestionKind } from '../../../shared/catalog.ts';
import type { AdminQuestion } from '../../../shared/schema.ts';
import { initSpeech, say } from '../../lib/speech.ts';
import { adminApi } from '../adminApi.ts';
import { drafts, useDrafts } from '../drafts.ts';
import { MediaField, Status, message, reorder } from '../fields.tsx';
import type { Voice } from './Content.tsx';
import { PlayButton, VoiceLine } from './VoicePanel.tsx';

const KINDS: Record<QuestionKind, string> = { scale5: '5 Smileys', scale3: '3 Smileys', yesno: 'Ja / Nein', choice: 'Bilder-Auswahl' };

type Props = { question: AdminQuestion; index: number; siblings: AdminQuestion[]; voice: Voice; onChanged: () => void };

export function QuestionEditor({ question: q, index, siblings, voice, onChanged }: Props) {
  useDrafts();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const v = drafts.view('question', q.id, q);
  const set = (patch: Partial<AdminQuestion>) => drafts.edit('question', q.id, patch);

  async function run(work: () => Promise<unknown>, done: string): Promise<void> {
    try {
      await work();
      setStatus(`✓ ${done}`);
      onChanged();
    } catch (err) {
      setStatus(message(err));
    }
  }

  const move = (step: -1 | 1) => run(() => reorder(siblings, index, step, (id) => `/api/v1/admin/questions/${id}`), 'Reihenfolge gespeichert');
  const remove = () => {
    if (!window.confirm('Diese Frage löschen?')) return;
    void run(async () => {
      await adminApi(`/api/v1/admin/questions/${q.id}`, { method: 'DELETE' });
      drafts.forget('question', q.id);
      for (const o of q.options) drafts.forget('option', o.id);
    }, 'Frage gelöscht');
  };
  // As the tablet will play it: own recording, else the Thorsten clip of the saved text, else the browser voice.
  const preview = () => {
    if (v.audioUrl) return void new Audio(v.audioUrl).play().catch(() => undefined);
    if (v.text === q.text && q.voiceUrl) return void new Audio(q.voiceUrl).play().catch(() => undefined);
    initSpeech(0.9);
    say(v.text, true);
  };

  return (
    <li class={v.active ? 'question-item' : 'question-item inactive'}>
      <div class="question-row">
        <span class="q-icon" aria-hidden="true">{v.icon}</span>
        <span class="q-text">{v.text}</span>
        <span class="badge">{KINDS[v.kind]}</span>
        <span class={v.frequency === 'core' ? 'badge core' : 'badge extended'}>{v.frequency === 'core' ? 'Kern' : 'ausführlich'}</span>
        {!v.active && <span class="badge">inaktiv</span>}
        {drafts.isChanged('question', q.id) && <span class="badge changed">geändert</span>}
        <span class="muted">{q.answerCount} Antw.</span>
        <button type="button" class="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Schließen' : 'Bearbeiten'}</button>
      </div>
      <VoiceLine text={v.text} savedText={q.text} voiceUrl={q.voiceUrl} status={voice.status} onRevoiced={voice.refresh} />
      {open && (
        <div class="form-grid question-form">
          <label class="wide">Frage (wird vorgelesen)<textarea rows={2} maxLength={200} required value={v.text} onInput={(e) => set({ text: e.currentTarget.value })} /></label>
          <label>Symbol (Emoji)<input value={v.icon} maxLength={16} required onInput={(e) => set({ icon: e.currentTarget.value })} /></label>
          <label>
            Art
            <select value={v.kind} disabled={q.answerCount > 0} onChange={(e) => set({ kind: e.currentTarget.value as QuestionKind })}>
              {Object.entries(KINDS).map(([value, label]) => <option value={value}>{label}</option>)}
            </select>
          </label>
          {v.kind === 'choice' && (
            <label class="check-label"><input type="checkbox" checked={v.multi} onChange={(e) => set({ multi: e.currentTarget.checked })} /> mehrere Antworten erlaubt</label>
          )}
          <label>
            Wann
            <select value={v.frequency} onChange={(e) => set({ frequency: e.currentTarget.value === 'extended' ? 'extended' : 'core' })}>
              <option value="core">Kern – jeden Tag</option>
              <option value="extended">ausführlich – nur an ausgewählten Tagen</option>
            </select>
          </label>
          <label class="check-label"><input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.currentTarget.checked })} /> aktiv</label>
          <MediaField label="Bild (statt Emoji)" kind="image" url={v.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
          <MediaField label="Eigene Aufnahme (hat Vorrang vor Thorsten)" kind="audio" url={v.audioUrl} onChange={(audioUrl) => set({ audioUrl })} />
          <div class="actions wide">
            <button type="button" class="ghost" onClick={preview}>🔊 Probe vorlesen</button>
            <button type="button" class="ghost" disabled={index === 0} onClick={() => void move(-1)}>↑</button>
            <button type="button" class="ghost" disabled={index === siblings.length - 1} onClick={() => void move(1)}>↓</button>
            {q.answerCount === 0 && <button type="button" class="danger" onClick={remove}>Löschen</button>}
          </div>
          {q.kind === 'choice' && <OptionsEditor question={q} onChanged={onChanged} />}
          {q.kind !== 'choice' && v.kind === 'choice' && <p class="muted wide">Erst speichern, dann Antworten anlegen.</p>}
        </div>
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
  const options = question.options;
  const path = (id: number) => `/api/v1/admin/options/${id}`;

  return (
    <fieldset class="wide options-editor">
      <legend>Antworten zum Antippen</legend>
      {options.map((o, i) => {
        const v = drafts.view('option', o.id, o);
        const set = (patch: Partial<typeof v>) => drafts.edit('option', o.id, patch);
        return (
          <div class={v.active ? 'option-row' : 'option-row inactive'}>
            <input aria-label="Symbol" class="icon-input" value={v.icon} maxLength={16} onInput={(e) => set({ icon: e.currentTarget.value })} />
            <input aria-label="Antwort (wird vorgelesen)" value={v.label} maxLength={40} onInput={(e) => set({ label: e.currentTarget.value })} />
            {o.voiceUrl && v.label === o.label && <PlayButton url={o.voiceUrl} label={`„${o.label}“ anhören`} />}
            <label class="check-label"><input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.currentTarget.checked })} /> aktiv</label>
            <button type="button" class="ghost" aria-label="nach oben" disabled={i === 0} onClick={() => void run(() => reorder(options, i, -1, path), 'Reihenfolge gespeichert')}>↑</button>
            <button type="button" class="ghost" aria-label="nach unten" disabled={i === options.length - 1} onClick={() => void run(() => reorder(options, i, 1, path), 'Reihenfolge gespeichert')}>↓</button>
            {o.answerCount === 0 && (
              <button type="button" class="danger" onClick={() => void run(() => adminApi(path(o.id), { method: 'DELETE' }).then(() => drafts.forget('option', o.id)), 'Antwort gelöscht')}>Löschen</button>
            )}
          </div>
        );
      })}
      <button type="button" class="ghost" onClick={() => void run(() => adminApi(`/api/v1/admin/questions/${question.id}/options`, { json: { label: 'Neue Antwort', icon: '⭐', sort: options.length } }), 'Antwort angelegt – Text eingeben, dann unten speichern')}>
        + Antwort
      </button>
      <Status text={status} />
    </fieldset>
  );
}
