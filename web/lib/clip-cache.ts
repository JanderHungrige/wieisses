// The kiosk's voice clips held in memory as blob: URLs (doc 01, "Which voice speaks"), so a clip —
// and the next part of a composed sentence — starts without a network round trip.

export type LoadClip = (url: string) => Promise<Blob>;

const fetchClip: LoadClip = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
};

const PARALLEL = 3;

export function createClipCache(load: LoadClip = fetchClip) {
  const ready = new Map<string, string>(); // clip URL → blob: URL
  const pending = new Set<string>();
  let wanted = new Set<string>();

  /** Fetches the clips not held yet, three at a time, and releases held ones not in `urls`. */
  async function prefetch(urls: readonly string[]): Promise<void> {
    wanted = new Set(urls);
    for (const [url, blobUrl] of ready) {
      if (wanted.has(url)) continue;
      URL.revokeObjectURL(blobUrl);
      ready.delete(url);
    }
    const todo = [...wanted].filter((url) => !ready.has(url) && !pending.has(url));
    const worker = async () => {
      for (let url = todo.shift(); url !== undefined; url = todo.shift()) {
        pending.add(url);
        try {
          const blob = await load(url);
          if (wanted.has(url)) ready.set(url, URL.createObjectURL(blob));
        } catch {
          // not held: it plays from its URL
        } finally {
          pending.delete(url);
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
  }

  return {
    prefetch,
    /** The in-memory URL of a clip, or the clip's own URL while it is not fetched. */
    resolve: (url: string): string => ready.get(url) ?? url,
  };
}
