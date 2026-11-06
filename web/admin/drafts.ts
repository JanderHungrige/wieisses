// Unsaved editor changes (doc 01, "Voice (Thorsten)"): field edits collect here — across topics,
// and across leaving the Fragen page — until "Speichern & vertonen" writes them all at once.
import { useEffect, useState } from 'preact/hooks';
import { adminApi } from './adminApi.ts';

export type DraftKind = 'topic' | 'question' | 'option';
type Patch = Record<string, unknown>;

const PATH: Record<DraftKind, (id: number) => string> = {
  topic: (id) => `/api/v1/admin/topics/${id}`,
  question: (id) => `/api/v1/admin/questions/${id}`,
  option: (id) => `/api/v1/admin/options/${id}`,
};

const store: Record<DraftKind, Map<number, Patch>> = { topic: new Map(), question: new Map(), option: new Map() };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const drafts = {
  edit(kind: DraftKind, id: number, patch: Patch): void {
    store[kind].set(id, { ...store[kind].get(id), ...patch });
    emit();
  },
  /** The saved item with its pending changes applied. */
  view<T extends object>(kind: DraftKind, id: number, saved: T): T {
    return { ...saved, ...store[kind].get(id) } as T;
  },
  isChanged(kind: DraftKind, id: number): boolean {
    return store[kind].has(id);
  },
  forget(kind: DraftKind, id: number): void {
    store[kind].delete(id);
    emit();
  },
  count(): number {
    return store.topic.size + store.question.size + store.option.size;
  },
  clear(): void {
    for (const map of Object.values(store)) map.clear();
    emit();
  },
  /** Writes every change; stops at the first refusal and keeps it and the rest as drafts. */
  async saveAll(): Promise<number> {
    let saved = 0;
    for (const kind of ['topic', 'question', 'option'] as const) {
      for (const [id, patch] of [...store[kind]]) {
        await adminApi(PATH[kind](id), { method: 'PATCH', json: patch });
        store[kind].delete(id);
        saved++;
        emit();
      }
    }
    return saved;
  },
};

/** Re-renders on every draft change; returns the number of changed items. */
export function useDrafts(): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return drafts.count();
}
