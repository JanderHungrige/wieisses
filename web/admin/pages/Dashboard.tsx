// Overview: totals, the topic index over time, one card per topic with the change against the
// previous period of equal length, and the CSV export (doc 01, "Dashboard").
import type { ResultsSummary, TopicMetrics } from '../../../shared/schema.ts';
import { useLoad } from '../adminApi.ts';
import { IndexChart } from '../charts.tsx';
import { chartColours } from '../colours.ts';
import { indexText, longDate } from '../format.ts';
import { FilterBar, query, type Filters } from './Filters.tsx';

type Props = { filters: Filters; setFilters: (f: Filters) => void };

export function Dashboard({ filters, setFilters }: Props) {
  const { data, error } = useLoad<ResultsSummary>(`/api/v1/admin/results/summary?${query(filters)}`);
  const colours = chartColours(data?.topics ?? []);
  return (
    <>
      <div class="page-head">
        <h1>Auswertung</h1>
        <a class="button" href={`/api/v1/admin/results/export.csv?${query(filters)}`} download>CSV exportieren</a>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      {error && <p class="error" role="alert">{error}</p>}
      {data && (
        <>
          <p class="muted">
            {longDate(data.from)} – {longDate(data.to)} · verglichen mit {longDate(data.previous.from)} – {longDate(data.previous.to)}
          </p>
          <div class="tiles">
            <Tile label="Abgaben" value={data.totals.submissions} before={data.totals.previous.submissions} />
            <Tile label="Kinder" value={data.totals.children} before={data.totals.previous.children} />
          </div>
          <section class="card" aria-labelledby="trend-title">
            <h2 id="trend-title">Stimmung je Thema</h2>
            <p class="muted">Index 0–100 aus den Smiley-Fragen: 0 = alle „schlecht“, 100 = alle „super“.</p>
            {data.topics.some((t) => t.series.length > 0) ? (
              <IndexChart topics={data.topics.filter((t) => t.series.length > 0)} colours={colours} bucket={data.bucket} />
            ) : (
              <p class="empty">Noch keine Antworten in diesem Zeitraum.</p>
            )}
          </section>
          <div class="topic-cards">
            {data.topics.map((t) => (
              <a class="card topic-card" href={`#/thema/${t.topicId}`}>
                <span class="swatch" style={{ background: colours.get(t.topicId) }} aria-hidden="true" />
                <h2>{t.icon} {t.name}{!t.active && ' (inaktiv)'}</h2>
                <p class="big-number">{indexText(t.index)}<Delta now={t.index} before={t.previous.index} /></p>
                <p class="muted">{t.submissions} Abgaben · {t.children} Kinder</p>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Tile({ label, value, before }: { label: string; value: number; before: number }) {
  return (
    <div class="card tile-stat">
      <p class="muted">{label}</p>
      <p class="big-number">{value}<Delta now={value} before={before} /></p>
    </div>
  );
}

function Delta({ now, before }: { now: TopicMetrics['index']; before: TopicMetrics['index'] }) {
  if (now === null || before === null) return null;
  const diff = Math.round(now - before);
  if (diff === 0) return <span class="delta same"> ± 0</span>;
  return (
    <span class={diff > 0 ? 'delta up' : 'delta down'}>
      {' '}
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}
      <span class="sr-only"> gegenüber dem Vorzeitraum</span>
    </span>
  );
}
