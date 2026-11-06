// Registered tablets. A tablet is registered from the tablet itself: log in here on it and
// press "Dieses Gerät freischalten" — the cookie is set on exactly that browser (doc 01).
import { useState } from 'preact/hooks';
import type { Device } from '../../../shared/schema.ts';
import { adminApi, useLoad } from '../adminApi.ts';
import { Status, message } from '../fields.tsx';
import { dateTime } from '../format.ts';

export function Devices() {
  const { data, error, reload } = useLoad<Device[]>('/api/v1/admin/devices');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  async function run(work: () => Promise<unknown>, done: string): Promise<void> {
    try {
      await work();
      setStatus(`✓ ${done}`);
      reload();
    } catch (err) {
      setStatus(message(err));
    }
  }

  const register = (e: Event) => {
    e.preventDefault();
    void run(async () => {
      await adminApi('/api/v1/admin/devices', { json: { label } });
      setRegistered(true);
      setLabel('');
    }, 'Dieses Gerät ist freigeschaltet');
  };

  return (
    <>
      <div class="page-head"><h1>Tablets</h1></div>
      <section class="card" aria-labelledby="register-title">
        <h2 id="register-title">Dieses Gerät freischalten</h2>
        <p class="muted">Nur freigeschaltete Geräte können abstimmen. Öffne diese Seite auf dem Tablet, melde dich an und gib ihm einen Namen.</p>
        <form class="inline-form" onSubmit={register}>
          <label for="device-label">Name des Tablets</label>
          <input id="device-label" value={label} maxLength={40} required placeholder="z. B. Tablet Mensa" onInput={(e) => setLabel(e.currentTarget.value)} />
          <button type="submit" class="primary">Freischalten</button>
        </form>
        {registered && (
          <p class="ok-box">
            Fertig! <a href="/">Zur Umfrage auf diesem Tablet</a>. Tipp: Seite zum Home-Bildschirm hinzufügen und – auf dem iPad – „Geführter Zugriff“ einschalten, damit die Kinder in der Umfrage bleiben.
          </p>
        )}
        <Status text={status} />
      </section>
      {error && <p class="error" role="alert">{error}</p>}
      <div class="table-wrap card">
        <table>
          <thead>
            <tr><th scope="col">Tablet</th><th scope="col">freigeschaltet</th><th scope="col">zuletzt benutzt</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {data?.map((d) => (
              <tr class={d.revoked ? 'inactive' : ''}>
                <th scope="row">{d.label}</th>
                <td>{dateTime(d.createdAt)}</td>
                <td>{dateTime(d.lastSeenAt)}</td>
                <td>
                  <button
                    type="button"
                    class={d.revoked ? 'primary' : 'danger'}
                    onClick={() => void run(() => adminApi(`/api/v1/admin/devices/${d.id}`, { method: 'PATCH', json: { revoked: !d.revoked } }), d.revoked ? 'Wieder freigeschaltet' : 'Gesperrt')}
                  >
                    {d.revoked ? 'Wieder freischalten' : 'Sperren'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.length === 0 && <p class="empty">Noch kein Tablet freigeschaltet.</p>}
      </div>
    </>
  );
}
