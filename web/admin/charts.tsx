// The dashboard's three charts (doc 01, "Dashboard"): topic index over time (lines), answer
// distribution over time (100 % stacked columns) and choice shares (bars). Thin marks, 2px surface
// gaps, recessive grid, legend for ≥ 2 series plus sparing direct labels, every chart with a table.
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { Bucket, QuestionResults, TopicSummary } from '../../shared/schema.ts';
import { ANSWER_COLOURS, INK } from './colours.ts';
import { bucketLabel, indexText, percent } from './format.ts';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend);
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.color = INK.secondary;

const grid = { color: INK.grid, lineWidth: 1 };
const legend = { position: 'top' as const, align: 'start' as const, labels: { usePointStyle: true, boxWidth: 8, color: INK.secondary } };

function ChartCanvas({ config, label, height = 280 }: { config: ChartConfiguration; label: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = new Chart(ref.current, config);
    return () => chart.destroy();
  }, [config]);
  return (
    <div class="chart" style={{ height: `${height}px` }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}

/** Name and value at the last point of each line, pushed apart so they never overlap. */
const endLabels: Plugin<'line'> = {
  id: 'endLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const labels: { x: number; y: number; text: string }[] = [];
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      const data = ds.data as (number | null)[];
      const last = data.findLastIndex((v) => v !== null);
      const point = meta.data[last];
      if (meta.hidden || last < 0 || !point) return;
      labels.push({ x: point.x + 10, y: point.y, text: `${ds.label ?? ''} ${indexText(data[last] ?? null)}` });
    });
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) {
      const prev = labels[i - 1];
      const cur = labels[i];
      if (prev && cur && cur.y - prev.y < 15) cur.y = prev.y + 15;
    }
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = INK.primary;
    ctx.textBaseline = 'middle';
    for (const l of labels) ctx.fillText(l.text, l.x, l.y);
    ctx.restore();
  },
};

export function IndexChart({ topics, colours, bucket }: { topics: TopicSummary[]; colours: Map<number, string>; bucket: Bucket }) {
  const config = useMemo((): ChartConfiguration => {
    const keys = [...new Set(topics.flatMap((t) => t.series.map((s) => s.bucket)))].sort();
    return {
      type: 'line',
      data: {
        labels: keys.map((k) => bucketLabel(k, bucket)),
        datasets: topics.map((t) => {
          const colour = colours.get(t.topicId) ?? INK.single;
          return {
            label: t.name,
            data: keys.map((k) => t.series.find((s) => s.bucket === k)?.index ?? null),
            borderColor: colour,
            backgroundColor: colour,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBorderColor: INK.surface,
            pointBorderWidth: 2,
            spanGaps: false,
          };
        }),
      },
      plugins: [endLabels],
      options: {
        maintainAspectRatio: false,
        layout: { padding: { right: 130 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 25, color: INK.muted }, grid, border: { display: false } },
          x: { grid: { display: false }, ticks: { color: INK.muted }, border: { color: INK.axis } },
        },
        plugins: {
          legend: { ...legend, display: topics.length > 1 },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${indexText(c.parsed.y)}` } },
        },
      },
    };
  }, [topics, colours, bucket]);
  return <ChartCanvas config={config} label="Stimmungs-Index je Thema im Zeitverlauf (0 = schlecht, 100 = super)" />;
}

export function DistributionChart({ results, bucket }: { results: QuestionResults; bucket: Bucket }) {
  const config = useMemo((): ChartConfiguration => {
    const kind = results.question.kind === 'choice' ? 'yesno' : results.question.kind;
    return {
      type: 'bar',
      data: {
        labels: results.series.map((b) => bucketLabel(b.bucket, bucket)),
        datasets: results.entries.map((entry, i) => ({
          label: `${entry.icon} ${entry.label}`,
          data: results.series.map((b) => {
            const e = b.entries.find((x) => x.key === entry.key);
            return b.n === 0 || !e ? 0 : (e.count / b.n) * 100;
          }),
          backgroundColor: ANSWER_COLOURS[kind][i] ?? INK.single,
          borderColor: INK.surface,
          borderWidth: { top: 2, bottom: 0, left: 0, right: 0 },
          borderSkipped: false,
          maxBarThickness: 24,
        })),
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { stacked: true, min: 0, max: 100, ticks: { stepSize: 25, color: INK.muted, callback: (v) => `${v} %` }, grid, border: { display: false } },
          x: { stacked: true, grid: { display: false }, ticks: { color: INK.muted }, border: { color: INK.axis } },
        },
        plugins: {
          legend,
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${Math.round(c.parsed.y ?? 0)} %` } },
        },
      },
    };
  }, [results, bucket]);
  return <ChartCanvas config={config} height={240} label={`Antworten auf „${results.question.text}“ im Zeitverlauf`} />;
}

/** Share of respondents per option, longest first, value at the tip. */
const tipLabels: Plugin<'bar'> = {
  id: 'tipLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0]?.data as number[] | undefined;
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = INK.primary;
    ctx.textBaseline = 'middle';
    meta.data.forEach((bar, i) => ctx.fillText(`${Math.round(data?.[i] ?? 0)} %`, bar.x + 6, bar.y));
    ctx.restore();
  },
};

export function ChoiceChart({ results }: { results: QuestionResults }) {
  const config = useMemo((): ChartConfiguration => {
    const sorted = [...results.entries].sort((a, b) => b.count - a.count);
    return {
      type: 'bar',
      data: {
        labels: sorted.map((e) => `${e.icon} ${e.label}`),
        datasets: [
          {
            label: 'Anteil der Kinder',
            data: sorted.map((e) => (results.n === 0 ? 0 : (e.count / results.n) * 100)),
            backgroundColor: INK.single,
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 24,
          },
        ],
      },
      plugins: [tipLabels],
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        layout: { padding: { right: 48 } },
        scales: {
          x: { min: 0, suggestedMax: 25, ticks: { color: INK.muted, callback: (v) => `${v} %` }, grid, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: INK.secondary }, border: { color: INK.axis } },
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${Math.round(c.parsed.x ?? 0)} % der Kinder` } } },
      },
    };
  }, [results]);
  return <ChartCanvas config={config} height={Math.max(160, results.entries.length * 34 + 40)} label={`Auswahl bei „${results.question.text}“`} />;
}

export function DistributionTable({ results }: { results: QuestionResults }) {
  return (
    <details class="table-view">
      <summary>Als Tabelle</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Antwort</th>
            <th scope="col" class="num">Anzahl</th>
            <th scope="col" class="num">Anteil</th>
          </tr>
        </thead>
        <tbody>
          {results.entries.map((e) => (
            <tr>
              <th scope="row">{e.icon} {e.label}</th>
              <td class="num">{e.count}</td>
              <td class="num">{percent(e.count, results.n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
