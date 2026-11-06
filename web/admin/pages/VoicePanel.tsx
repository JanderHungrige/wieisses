// The Thorsten voice in the editor: overall state, "Fehlende vertonen" / "Alle neu vertonen",
// and per text a state line with ▶ and "Neu vertonen" (doc 01, "Voice (Thorsten)").
import { useEffect, useRef, useState } from 'preact/hooks';
import { normaliseText } from '../../../shared/phrases.ts';
import type { VoiceStatus } from '../../../shared/schema.ts';
import { adminApi } from '../adminApi.ts';
import { message } from '../fields.tsx';

const busy = (s: VoiceStatus | null) => s !== null && (s.queued > 0 || s.working !== null);

/** Loads the voice state, polling every 2 s while a run is going; `onFinished` after a run. */
export function useVoiceStatus(onFinished: () => void): { status: VoiceStatus | null; refresh: () => void } {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [tick, setTick] = useState(0);
  const finished = useRef(onFinished);
  finished.current = onFinished;
  useEffect(() => {
    let live = true;
    let timer = 0;
    let wasBusy = false;
    const load = async () => {
      const next = await adminApi<VoiceStatus>('/api/v1/admin/voice').catch(() => null);
      if (!live || !next) return;
      setStatus(next);
      if (wasBusy && !busy(next)) finished.current();
      wasBusy = busy(next);
      if (wasBusy) timer = window.setTimeout(() => void load(), 2000);
    };
    void load();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [tick]);
  return { status, refresh: () => setTick((t) => t + 1) };
}

export async function startVoicing(mode: 'missing' | 'all'): Promise<void> {
  await adminApi('/api/v1/admin/voice/generate', { json: { mode } });
}

export function VoicePanel({ status, refresh }: { status: VoiceStatus | null; refresh: () => void }) {
  const [error, setError] = useState<string | null>(null);
  if (!status) return null;
  if (!status.configured) {
    return (
      <section class="card voice-panel" aria-labelledby="voice-title">
        <h2 id="voice-title">🎙️ Thorsten-Stimme</h2>
        <p class="muted">Auf diesem Server nicht eingerichtet – die Tablets lesen mit ihrer eigenen Stimme vor.</p>
      </section>
    );
  }
  const run = (mode: 'missing' | 'all') => {
    if (mode === 'all' && !window.confirm(`Alle ${status.total} Texte neu vertonen? Das dauert ein paar Minuten.`)) return;
    startVoicing(mode).then(refresh, (err: unknown) => setError(message(err)));
  };
  const active = status.queued + (status.working ? 1 : 0);
  return (
    <section class="card voice-panel" aria-labelledby="voice-title">
      <h2 id="voice-title">🎙️ Thorsten-Stimme</h2>
      <p>
        <progress max={status.total} value={status.ready} aria-label="vertont" /> {status.ready} von {status.total} Texten vertont
        {active > 0 && ` · ⏳ ${active} in Arbeit`}
        {status.reachable === false && <strong class="error"> · Stimme nicht erreichbar</strong>}
      </p>
      {status.working && <p class="muted">Gerade: „{status.working}“</p>}
      {status.failed.length > 0 && (
        <details>
          <summary>{status.failed.length} Text(e) mit Fehler</summary>
          <ul>{status.failed.map((f) => <li>„{f.text}“ – {f.message}</li>)}</ul>
        </details>
      )}
      <div class="actions">
        <button type="button" class="ghost" disabled={active > 0 || status.ready === status.total} onClick={() => run('missing')}>Fehlende vertonen</button>
        <button type="button" class="ghost" disabled={active > 0} onClick={() => run('all')}>Alle neu vertonen</button>
      </div>
      {error && <p class="error" role="alert">{error}</p>}
    </section>
  );
}

export function PlayButton({ url, label = 'Anhören' }: { url: string; label?: string }) {
  return (
    <button type="button" class="ghost play" aria-label={label} onClick={() => void new Audio(url).play().catch(() => undefined)}>▶</button>
  );
}

type LineProps = { text: string; savedText: string; voiceUrl: string | null; status: VoiceStatus | null; onRevoiced: () => void };

/** The voice state of one saved text, as it will be on the tablets. */
export function VoiceLine({ text, savedText, voiceUrl, status, onRevoiced }: LineProps) {
  if (!status?.configured) return null;
  const saved = normaliseText(savedText);
  const failed = status.failed.find((f) => f.text === saved);
  const revoice = () => void adminApi('/api/v1/admin/voice/clip', { json: { text: saved } }).then(onRevoiced, () => undefined);
  if (normaliseText(text) !== saved) return <span class="voice-state pending">🎙️ wird beim Speichern neu vertont</span>;
  if (status.working === saved) return <span class="voice-state">⏳ wird gerade vertont …</span>;
  if (failed) return <span class="voice-state error">⚠ {failed.message}</span>;
  if (!voiceUrl) return <span class="voice-state missing">🎙️ noch nicht vertont</span>;
  return (
    <span class="voice-state ok">
      🎙️ Thorsten <PlayButton url={voiceUrl} label={`„${saved}“ anhören`} />
      <button type="button" class="ghost" onClick={revoice}>Neu vertonen</button>
    </span>
  );
}
