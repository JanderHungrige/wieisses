// Dashboard numbers and the CSV export (doc 01, "Statistics" and "Dashboard"). Rows come from
// the results adapter; every figure is computed by the pure functions in domain/stats.ts.
import { FACES, isScale } from '../../shared/catalog.ts';
import type { Distribution, QuestionResults, ResultsQuery, ResultsSummary, TopicMetrics, TopicSummary } from '../../shared/schema.ts';
import { allTopics, getQuestion, optionsOf } from '../adapters/content-store.ts';
import { answerFacts, exportRows, submissionRows, type AnswerFact, type SubmissionRow } from '../adapters/results-store.ts';
import { toCsv } from '../domain/csv.ts';
import { previousRange } from '../domain/day.ts';
import { choiceDistribution, scaleDistribution, series, topicIndex } from '../domain/stats.ts';
import type { App } from '../context.ts';
import { HttpError, ok, type Reply } from '../http/reply.ts';

function metrics(subs: readonly SubmissionRow[], facts: readonly AnswerFact[]): TopicMetrics {
  return { submissions: subs.length, children: new Set(subs.map((s) => s.codeId)).size, index: topicIndex(facts) };
}

export function summary(app: App, q: ResultsQuery): Reply {
  const prev = previousRange(q.from, q.to);
  const subs = submissionRows(app.db, q);
  const facts = answerFacts(app.db, q);
  const prevSubs = submissionRows(app.db, { ...prev, grade: q.grade });
  const prevFacts = answerFacts(app.db, { ...prev, grade: q.grade });
  const topics: TopicSummary[] = allTopics(app.db)
    .filter((topic) => topic.active || subs.some((s) => s.topicId === topic.id))
    .map((topic) => {
      const mine = subs.filter((s) => s.topicId === topic.id);
      const myFacts = facts.filter((f) => f.topicId === topic.id);
      const indexBy = new Map(series(myFacts, q.bucket, (rows) => ({ index: topicIndex(rows) })).map((b) => [b.bucket, b.index]));
      return {
        topicId: topic.id,
        name: topic.name,
        color: topic.color,
        icon: topic.icon,
        active: topic.active,
        ...metrics(mine, myFacts),
        previous: metrics(
          prevSubs.filter((s) => s.topicId === topic.id),
          prevFacts.filter((f) => f.topicId === topic.id),
        ),
        series: series(mine, q.bucket, (rows) => ({ submissions: rows.length })).map((b) => ({
          ...b,
          index: indexBy.get(b.bucket) ?? null,
        })),
      };
    });
  const result: ResultsSummary = {
    from: q.from,
    to: q.to,
    previous: prev,
    bucket: q.bucket,
    grade: q.grade ?? null,
    totals: {
      submissions: subs.length,
      children: new Set(subs.map((s) => s.codeId)).size,
      previous: { submissions: prevSubs.length, children: new Set(prevSubs.map((s) => s.codeId)).size },
    },
    topics,
  };
  return ok(result);
}

export function questionResults(app: App, id: number, q: ResultsQuery): Reply {
  const question = getQuestion(app.db, id);
  if (!question) throw new HttpError(404, 'not_found', 'Diese Frage gibt es nicht.');
  const facts = answerFacts(app.db, q, id);
  const kind = question.kind;
  const options = kind === 'choice' ? optionsOf(app.db, id) : [];
  const distribute = (rows: AnswerFact[]): Distribution =>
    kind === 'choice'
      ? choiceDistribution(options, rows.flatMap((r) => (r.optionId === null ? [] : [{ submissionId: r.submissionId, optionId: r.optionId }])))
      : scaleDistribution(kind, rows.flatMap((r) => (r.value === null ? [] : [r.value])));
  const result: QuestionResults = {
    question: { id: question.id, topicId: question.topicId, kind, multi: question.multi, text: question.text, icon: question.icon },
    ...distribute(facts),
    series: series(facts, q.bucket, distribute),
  };
  return ok(result);
}

const HEADER = ['Datum', 'Klasse', 'Thema', 'Frage', 'Art', 'Wert', 'Antwort', 'Ausführlich'] as const;

export function exportCsv(app: App, q: ResultsQuery): Reply {
  const rows = exportRows(app.db, q).map((r) => {
    const face = r.kind !== 'choice' && r.value !== null ? FACES[r.kind].find((f) => f.value === r.value) : undefined;
    return [r.day, r.grade, r.topic, r.question, r.kind, isScale(r.kind) || r.kind === 'yesno' ? r.value : null, face?.label ?? r.option, r.extended ? 'ja' : 'nein'];
  });
  return {
    status: 200,
    raw: toCsv(HEADER, rows),
    type: 'text/csv; charset=utf-8',
    headers: {
      'Content-Disposition': `attachment; filename="wieisses-${q.from}-bis-${q.to}.csv"`,
      'Cache-Control': 'no-store',
    },
  };
}
