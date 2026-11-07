import { afterEach, describe, it, expect, vi } from 'vitest';
import { createClipCache } from '../../web/lib/clip-cache.ts';

const mp3 = () => new Blob([new Uint8Array([0xff, 0xfb, 0x90, 0x00])], { type: 'audio/mpeg' });

/** A loader whose calls stay pending until the test settles them. */
function controlledLoader() {
  const calls: { url: string; resolve: (b: Blob) => void; reject: (e: Error) => void }[] = [];
  const load = (url: string) => new Promise<Blob>((resolve, reject) => calls.push({ url, resolve, reject }));
  return { calls, load };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Clip cache (web/lib/clip-cache.ts)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves a clip to itself until it is fetched, then to an in-memory blob: URL', async () => {
    const cache = createClipCache(async () => mp3());
    expect(cache.resolve('/media/a.mp3')).toBe('/media/a.mp3');
    await cache.prefetch(['/media/a.mp3']);
    expect(cache.resolve('/media/a.mp3')).toMatch(/^blob:/);
    expect(cache.resolve('/media/other.mp3')).toBe('/media/other.mp3');
  });

  it('fetches every URL once, also across repeated prefetches and duplicates', async () => {
    const load = vi.fn(async (_url: string) => mp3());
    const cache = createClipCache(load);
    await cache.prefetch(['/media/a.mp3', '/media/b.mp3', '/media/a.mp3']);
    await cache.prefetch(['/media/a.mp3', '/media/b.mp3']);
    expect(load.mock.calls.map((c) => c[0]).sort()).toEqual(['/media/a.mp3', '/media/b.mp3']);
  });

  it('keeps going when one clip fails; the failed one keeps playing from its URL', async () => {
    const cache = createClipCache(async (url) => {
      if (url.endsWith('bad.mp3')) throw new Error('404');
      return mp3();
    });
    await cache.prefetch(['/media/bad.mp3', '/media/good.mp3']);
    expect(cache.resolve('/media/bad.mp3')).toBe('/media/bad.mp3');
    expect(cache.resolve('/media/good.mp3')).toMatch(/^blob:/);
  });

  it('has at most three fetches in flight', async () => {
    const { calls, load } = controlledLoader();
    const cache = createClipCache(load);
    const done = cache.prefetch(['/1.mp3', '/2.mp3', '/3.mp3', '/4.mp3', '/5.mp3']);
    await flush();
    expect(calls).toHaveLength(3);
    calls[0]!.resolve(mp3());
    await flush();
    expect(calls).toHaveLength(4);
    for (const c of calls.slice(1)) c.resolve(mp3());
    await flush();
    calls[4]!.resolve(mp3());
    await done;
    expect(calls.map((c) => c.url)).toEqual(['/1.mp3', '/2.mp3', '/3.mp3', '/4.mp3', '/5.mp3']);
  });

  it('releases clips that are no longer in the config', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const cache = createClipCache(async () => mp3());
    await cache.prefetch(['/media/old.mp3', '/media/keep.mp3']);
    const oldBlob = cache.resolve('/media/old.mp3');
    await cache.prefetch(['/media/keep.mp3', '/media/new.mp3']);
    expect(revoke).toHaveBeenCalledWith(oldBlob);
    expect(cache.resolve('/media/old.mp3')).toBe('/media/old.mp3');
    expect(cache.resolve('/media/keep.mp3')).toMatch(/^blob:/);
    expect(cache.resolve('/media/new.mp3')).toMatch(/^blob:/);
  });
});
