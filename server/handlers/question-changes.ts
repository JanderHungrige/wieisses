// The question tool's batch (doc 04, "Question changes"): a change list goes through the admin
// editor's own handlers inside one transaction — rolled back again for a dry run — and the
// difference between before and after is reported. The first refused entry undoes every entry.
import type { ContentChange } from '../../shared/schema.ts';
import { adminTopics } from '../adapters/content-store.ts';
import { transaction } from '../adapters/db.ts';
import { describeChanges } from '../domain/content-diff.ts';
import { HttpError, type Reply } from '../http/reply.ts';
import * as content from './content.ts';

export class ChangeRefused extends Error {}
class DryRun extends Error {}

export type ChangeOutcome = { saved: boolean; lines: string[] };

type Refs = Map<string, number>;

function createdId(reply: Reply): number {
  return (reply.body as { id: number }).id;
}

function resolve(refs: Refs, target: number | string): number {
  if (typeof target === 'number') return target;
  const found = refs.get(target);
  if (found === undefined) throw new HttpError(400, 'unknown_ref', `Verweis „${target}“ ist nicht bekannt.`);
  return found;
}

function remember(refs: Refs, ref: string | undefined, id: number): void {
  if (ref !== undefined) refs.set(ref, id);
}

function applyOne(deps: content.ContentDeps, change: ContentChange, refs: Refs): void {
  if ((change.op === 'topic.create' || change.op === 'question.create') && change.ref !== undefined && refs.has(change.ref)) {
    throw new HttpError(400, 'duplicate_ref', `Verweis „${change.ref}“ gibt es schon.`);
  }
  switch (change.op) {
    case 'topic.create':
      return remember(refs, change.ref, createdId(content.createTopic(deps, change.topic)));
    case 'topic.update':
      return void content.updateTopic(deps, change.id, change.patch);
    case 'topic.delete':
      return void content.removeTopic(deps, change.id);
    case 'question.create': {
      const id = createdId(content.createQuestion(deps, resolve(refs, change.topic), change.question));
      for (const option of change.options) content.createOption(deps, id, option);
      return remember(refs, change.ref, id);
    }
    case 'question.update':
      return void content.updateQuestion(deps, change.id, change.patch);
    case 'question.delete':
      return void content.removeQuestion(deps, change.id);
    case 'option.create':
      return void content.createOption(deps, resolve(refs, change.question), change.option);
    case 'option.update':
      return void content.updateOption(deps, change.id, change.patch);
    case 'option.delete':
      return void content.removeOption(deps, change.id);
    default:
      throw new Error(`unhandled change: ${change satisfies never}`);
  }
}

/** "Änderung 3 (question.update 12)" — how a refusal names its entry. */
function entryName(change: ContentChange, index: number): string {
  return `Änderung ${index + 1} (${change.op}${'id' in change ? ` ${change.id}` : ''})`;
}

/** Applies `changes` in order; `commit` false rolls everything back after computing the report. */
export function applyChanges(deps: content.ContentDeps, changes: readonly ContentChange[], commit: boolean): ChangeOutcome {
  const before = adminTopics(deps.db);
  let lines: string[] = [];
  try {
    transaction(deps.db, () => {
      const refs: Refs = new Map();
      changes.forEach((change, index) => {
        try {
          applyOne(deps, change, refs);
        } catch (err) {
          if (err instanceof HttpError) throw new ChangeRefused(`${entryName(change, index)}: ${err.message}`);
          throw err;
        }
      });
      lines = describeChanges(before, adminTopics(deps.db));
      if (!commit) throw new DryRun();
    });
  } catch (err) {
    if (!(err instanceof DryRun)) throw err;
  }
  return { saved: commit, lines };
}
