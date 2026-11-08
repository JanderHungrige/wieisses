// Has a new build been deployed since this page loaded? (doc 01, the child's flow, step 8). A
// tablet keeps running the code it loaded, so between two children the kiosk asks for `/` again
// and compares the built files it references — their names carry a content hash.

const BUILT = /\b(?:src|href)=["'](\/assets\/[^"']+)["']/g;

/** Every `/assets/…` file a page references in a src or href, sorted, once each. */
export function builtFiles(html: string): string[] {
  return [...new Set([...html.matchAll(BUILT)].map((m) => m[1] ?? ''))].filter(Boolean).sort();
}

/** True when `served` is another build than `running`; never when either lists no built files. */
export function isNewBuild(running: readonly string[], served: readonly string[]): boolean {
  if (running.length === 0 || served.length === 0) return false;
  return running.length !== served.length || running.some((file, i) => file !== served[i]);
}

const fetchPage = async (): Promise<string> => {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

/** Asks the server for the kiosk page; false when it serves the `running` build or cannot be asked. */
export async function newBuildServed(running: string, load = fetchPage): Promise<boolean> {
  try {
    return isNewBuild(builtFiles(running), builtFiles(await load()));
  } catch {
    return false;
  }
}
