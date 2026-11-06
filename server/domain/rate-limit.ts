// Sliding-window counters for failed logins, code guesses and new codes (doc 01). In memory:
// one container serves the school, and a restart forgetting the counts is harmless.

export type Limiter = {
  /** True while `key` has fewer than `limit` hits in the window. */
  allowed(key: string): boolean;
  /** Records one hit for `key`. */
  hit(key: string): void;
};

export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now): Limiter {
  const hits = new Map<string, number[]>();

  function recent(key: string): number[] {
    const since = now() - windowMs;
    const kept = (hits.get(key) ?? []).filter((at) => at > since);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
    return kept;
  }

  return {
    allowed: (key) => recent(key).length < limit,
    hit: (key) => {
      hits.set(key, [...recent(key), now()]);
    },
  };
}
