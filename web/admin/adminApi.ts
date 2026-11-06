// Admin calls: like api(), but an expired session sends the app back to the login form.
import { useEffect, useState } from 'preact/hooks';
import { ApiError, api } from '../lib/api.ts';

export const LOGGED_OUT = 'wieisses:logged-out';

export async function adminApi<T>(path: string, options?: Parameters<typeof api>[1]): Promise<T> {
  try {
    return await api<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'not_logged_in') window.dispatchEvent(new Event(LOGGED_OUT));
    throw err;
  }
}

export type Loaded<T> = { data: T | undefined; error: string | null; reload: () => void };

/** Loads `path` whenever it changes; `reload` fetches again after a change. */
export function useLoad<T>(path: string | null): Loaded<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    adminApi<T>(path)
      .then((value) => live && (setData(value), setError(null)))
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : 'Fehler beim Laden.'));
    return () => {
      live = false;
    };
  }, [path, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}

export function useRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}
