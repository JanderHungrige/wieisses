// Settings: title, weekdays for the detailed questions, reading aloud, idle time, grades.
import { useEffect, useState } from 'preact/hooks';
import { SettingsSchema, type Settings } from '../../../shared/schema.ts';
import { initSpeech, say } from '../../lib/speech.ts';
import { adminApi, useLoad } from '../adminApi.ts';
import { Status, message } from '../fields.tsx';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toggle(list: number[], value: number): number[] {
  return (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]).sort((a, b) => a - b);
}

export function SettingsPage() {
  const { data, error } = useLoad<Settings>('/api/v1/admin/settings');
  const [draft, setDraft] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setDraft(data ?? null), [data]);
  if (error) return <p class="error" role="alert">{error}</p>;
  if (!draft) return <p>Einen Moment …</p>;
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  async function save(e: Event): Promise<void> {
    e.preventDefault();
    const checked = SettingsSchema.safeParse(draft);
    if (!checked.success) return setStatus(checked.error.issues[0]?.message ?? 'Ungültige Eingabe.');
    try {
      setDraft(await adminApi<Settings>('/api/v1/admin/settings', { method: 'PUT', json: checked.data }));
      setStatus('✓ Gespeichert – die Tablets übernehmen es beim nächsten Start.');
    } catch (err) {
      setStatus(message(err));
    }
  }

  return (
    <>
      <div class="page-head"><h1>Einstellungen</h1></div>
      <form class="card form-grid" onSubmit={(e) => void save(e)}>
        <label>Titel auf dem Startbildschirm<input value={draft.title} maxLength={40} required onInput={(e) => set({ title: e.currentTarget.value })} /></label>
        <fieldset>
          <legend>Ausführliche Fragen an diesen Tagen</legend>
          {WEEKDAYS.map((name, i) => (
            <label class="check-label"><input type="checkbox" checked={draft.extendedWeekdays.includes(i + 1)} onChange={() => set({ extendedWeekdays: toggle(draft.extendedWeekdays, i + 1) })} /> {name}</label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Klassen, die Kinder auswählen können</legend>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <label class="check-label"><input type="checkbox" checked={draft.grades.includes(g)} onChange={() => set({ grades: toggle(draft.grades, g) })} /> {g}</label>
          ))}
        </fieldset>
        <label class="check-label"><input type="checkbox" checked={draft.autoRead} onChange={(e) => set({ autoRead: e.currentTarget.checked })} /> Fragen automatisch vorlesen</label>
        <label>
          Sprechtempo ({draft.speechRate.toLocaleString('de-DE')})
          <span class="colour-row">
            <input type="range" min={0.6} max={1.3} step={0.05} value={draft.speechRate} onInput={(e) => set({ speechRate: Number(e.currentTarget.value) })} />
            <button type="button" class="ghost" onClick={() => (initSpeech(draft.speechRate), say('Wie hat dir das Essen heute geschmeckt?', true))}>🔊 Probe</button>
          </span>
        </label>
        <label>
          Zurück zum Start nach so vielen Sekunden ohne Berührung
          <input type="number" min={20} max={600} value={draft.idleSeconds} onInput={(e) => set({ idleSeconds: Number(e.currentTarget.value) })} />
        </label>
        <div class="actions"><button type="submit" class="primary">Speichern</button></div>
        <Status text={status} />
      </form>
    </>
  );
}
