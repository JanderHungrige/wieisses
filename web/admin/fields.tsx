// Small pieces shared by the editor pages.
import { useState } from 'preact/hooks';
import { adminApi } from './adminApi.ts';

/** Uploads a picture or recording and hands back its /media URL; "Entfernen" hands back null. */
export function MediaField(props: { label: string; kind: 'image' | 'audio'; url: string | null; onChange: (url: string | null) => void }) {
  const { label, kind, url, onChange } = props;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `media-${kind}-${Math.random().toString(36).slice(2, 8)}`;

  async function upload(file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi<{ url: string }>('/api/v1/admin/media', { raw: file });
      onChange(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hochladen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="media-field">
      <label for={id}>{label}</label>
      {url && kind === 'image' && <img src={url} alt="" width={64} height={64} />}
      {url && kind === 'audio' && <audio src={url} controls preload="none" />}
      <input
        id={id}
        type="file"
        accept={kind === 'image' ? 'image/png,image/jpeg,image/webp' : 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,.m4a'}
        disabled={busy}
        onChange={(e) => void upload(e.currentTarget.files?.[0])}
      />
      {url && <button type="button" class="ghost" onClick={() => onChange(null)}>Entfernen</button>}
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}

/** Moves item `index` one place up (-1) or down (+1) and stores the new order as sort values. */
export async function reorder(items: readonly { id: number; sort: number }[], index: number, step: -1 | 1, path: (id: number) => string): Promise<void> {
  const order = [...items];
  const target = index + step;
  if (target < 0 || target >= order.length) return;
  const [moved] = order.splice(index, 1);
  if (moved) order.splice(target, 0, moved);
  await Promise.all(
    order.map((item, sort) => (item.sort === sort ? null : adminApi(path(item.id), { method: 'PATCH', json: { sort } }))),
  );
}

export function Status({ text }: { text: string | null }) {
  return (
    <p class={text?.startsWith('✓') ? 'status ok' : 'status error'} role="status" aria-live="polite">
      {text ?? ''}
    </p>
  );
}

export const message = (err: unknown) => (err instanceof Error ? err.message : 'Da ist etwas schiefgegangen.');
