// One topic in detail: per question the answer distribution over time, or the option shares.
import type { AdminTopic, QuestionResults } from '../../../shared/schema.ts';
import { useLoad } from '../adminApi.ts';
import { ChoiceChart, DistributionChart, DistributionTable } from '../charts.tsx';
import { FilterBar, query, type Filters } from './Filters.tsx';

type Props = { topicId: number; filters: Filters; setFilters: (f: Filters) => void };

export function TopicResults({ topicId, filters, setFilters }: Props) {
  const topics = useLoad<AdminTopic[]>('/api/v1/admin/topics');
  const topic = topics.data?.find((t) => t.id === topicId);
  return (
    <>
      <div class="page-head">
        <h1>{topic ? `${topic.icon} ${topic.name}` : 'Thema'}</h1>
        <a class="button" href="#/">← Übersicht</a>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      {topics.error && <p class="error" role="alert">{topics.error}</p>}
      {topic?.questions.map((q) => <QuestionCard key={q.id} questionId={q.id} q={query(filters)} filters={filters} />)}
    </>
  );
}

function QuestionCard({ questionId, q, filters }: { questionId: number; q: string; filters: Filters }) {
  const { data, error } = useLoad<QuestionResults>(`/api/v1/admin/results/questions/${questionId}?${q}`);
  if (error) return <p class="error">{error}</p>;
  if (!data) return null;
  const kind = data.question.kind;
  const max = kind === 'scale5' ? 5 : 3;
  return (
    <section class="card" aria-labelledby={`q-${questionId}`}>
      <h2 id={`q-${questionId}`}>{data.question.icon} {data.question.text}</h2>
      <p class="muted">
        {data.n} {kind === 'choice' ? 'Kinder haben gewählt' : 'Antworten'}
        {data.mean !== null && ` · Durchschnitt ${data.mean.toLocaleString('de-DE')} von ${max}`}
        {kind === 'choice' && data.question.multi && ' · Mehrfachauswahl'}
      </p>
      {data.n === 0 ? (
        <p class="empty">Keine Antworten in diesem Zeitraum.</p>
      ) : kind === 'choice' ? (
        <ChoiceChart results={data} />
      ) : (
        <DistributionChart results={data} bucket={filters.bucket} />
      )}
      {data.n > 0 && <DistributionTable results={data} />}
    </section>
  );
}
