// The one row of filters above the charts: range, bucket, grade.
import type { Bucket } from '../../../shared/schema.ts';
import { addDays, schoolYearStart, todayBerlin } from '../format.ts';

export type Preset = '7' | '30' | '90' | 'year' | 'custom';
export type Filters = { preset: Preset; from: string; to: string; bucket: Bucket; grade: number | null };

function rangeFor(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const to = todayBerlin();
  if (preset === 'year') return { from: schoolYearStart(to), to };
  return { from: addDays(to, 1 - Number(preset)), to };
}

export const defaultFilters = (): Filters => ({ preset: '30', ...rangeFor('30'), bucket: 'week', grade: null });

export function query(f: Filters): string {
  const q = new URLSearchParams({ from: f.from, to: f.to, bucket: f.bucket });
  if (f.grade !== null) q.set('grade', String(f.grade));
  return q.toString();
}

const PRESETS: [Preset, string][] = [
  ['7', '7 Tage'],
  ['30', '30 Tage'],
  ['90', '90 Tage'],
  ['year', 'Schuljahr'],
  ['custom', 'Eigener Zeitraum'],
];

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div class="filters" role="group" aria-label="Filter">
      <label>
        Zeitraum
        <select
          value={filters.preset}
          onChange={(e) => {
            const preset = e.currentTarget.value as Preset;
            set(preset === 'custom' ? { preset } : { preset, ...rangeFor(preset) });
          }}
        >
          {PRESETS.map(([value, label]) => <option value={value}>{label}</option>)}
        </select>
      </label>
      {filters.preset === 'custom' && (
        <>
          <label>
            von
            <input type="date" value={filters.from} max={filters.to} onChange={(e) => set({ from: e.currentTarget.value })} />
          </label>
          <label>
            bis
            <input type="date" value={filters.to} min={filters.from} onChange={(e) => set({ to: e.currentTarget.value })} />
          </label>
        </>
      )}
      <label>
        Einteilung
        <select value={filters.bucket} onChange={(e) => set({ bucket: e.currentTarget.value as Bucket })}>
          <option value="day">Tage</option>
          <option value="week">Wochen</option>
          <option value="month">Monate</option>
        </select>
      </label>
      <label>
        Klasse
        <select value={filters.grade ?? ''} onChange={(e) => set({ grade: e.currentTarget.value ? Number(e.currentTarget.value) : null })}>
          <option value="">alle</option>
          {[1, 2, 3, 4, 5, 6].map((g) => <option value={g}>Klasse {g}</option>)}
        </select>
      </label>
    </div>
  );
}
