// Children's secret signs: new signs per day (a spike means someone is making signs to vote
// again), the list with grade and tablet, and switching a sign off (doc 01, "Repeat protection").
import { useState } from 'preact/hooks';
import { animal, colour, fruit } from '../../../shared/catalog.ts';
import type { CodesOverview } from '../../../shared/schema.ts';
import { adminApi, useLoad } from '../adminApi.ts';
import { Status, message } from '../fields.tsx';
import { dateTime, shortDate } from '../format.ts';

export function Codes() {
  const [grade, setGrade] = useState('');
  const [active, setActive] = useState('');
  const q = new URLSearchParams({ ...(grade ? { grade } : {}), ...(active ? { active } : {}) }).toString();
  const { data, error, reload } = useLoad<CodesOverview>(`/api/v1/admin/codes${q ? `?${q}` : ''}`);
  const [status, setStatus] = useState<string | null>(null);

  async function patch(id: number, json: { active?: boolean; grade?: number }): Promise<void> {
    try {
      await adminApi(`/api/v1/admin/codes/${id}`, { method: 'PATCH', json });
      setStatus('✓ Gespeichert');
      reload();
    } catch (err) {
      setStatus(message(err));
    }
  }

  const most = Math.max(1, ...(data?.newPerDay.map((d) => d.count) ?? [1]));
  return (
    <>
      <div class="page-head"><h1>Geheimzeichen</h1></div>
      <p class="muted">Kinder suchen sich ihr Zeichen selbst aus. Namen werden nicht gespeichert. Ein abgeschaltetes Zeichen kann sich nicht mehr anmelden; seine Antworten bleiben in der Auswertung.</p>
      {error && <p class="error" role="alert">{error}</p>}
      <section class="card" aria-labelledby="new-codes">
        <h2 id="new-codes">Neue Zeichen pro Tag (letzte 14 Tage)</h2>
        {data && data.newPerDay.length === 0 && <p class="empty">Keine neuen Zeichen.</p>}
        <ul class="day-bars">
          {data?.newPerDay.map((d) => (
            <li>
              <span class="day">{shortDate(d.day)}</span>
              <span class="bar" style={{ width: `${(d.count / most) * 100}%` }} aria-hidden="true" />
              <span class="count">{d.count}</span>
            </li>
          ))}
        </ul>
      </section>
      <div class="filters" role="group" aria-label="Filter">
        <label>Klasse<select value={grade} onChange={(e) => setGrade(e.currentTarget.value)}><option value="">alle</option>{[1, 2, 3, 4, 5, 6].map((g) => <option value={g}>Klasse {g}</option>)}</select></label>
        <label>Status<select value={active} onChange={(e) => setActive(e.currentTarget.value)}><option value="">alle</option><option value="true">aktiv</option><option value="false">abgeschaltet</option></select></label>
      </div>
      <Status text={status} />
      <div class="table-wrap card">
        <table>
          <thead>
            <tr><th scope="col">Zeichen</th><th scope="col">Klasse</th><th scope="col">Tablet</th><th scope="col">angelegt</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {data?.codes.map((c) => (
              <tr class={c.active ? '' : 'inactive'}>
                <th scope="row">
                  <span aria-hidden="true">{animal(c.animal)?.emoji} </span>
                  <span class="dot-sm" style={{ background: colour(c.color)?.hex }} aria-hidden="true" />
                  <span aria-hidden="true"> {fruit(c.fruit)?.emoji} </span>
                  {animal(c.animal)?.name}, {colour(c.color)?.name}, {fruit(c.fruit)?.name}
                </th>
                <td>
                  <select aria-label="Klasse ändern" value={c.grade} onChange={(e) => void patch(c.id, { grade: Number(e.currentTarget.value) })}>
                    {[1, 2, 3, 4, 5, 6].map((g) => <option value={g}>{g}</option>)}
                  </select>
                </td>
                <td>{c.deviceLabel ?? '–'}</td>
                <td>{dateTime(c.createdAt)}</td>
                <td>
                  <button type="button" class={c.active ? 'ghost' : 'primary'} onClick={() => void patch(c.id, { active: !c.active })}>
                    {c.active ? 'Abschalten' : 'Wieder an'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.codes.length === 0 && <p class="empty">Keine Zeichen.</p>}
      </div>
    </>
  );
}
