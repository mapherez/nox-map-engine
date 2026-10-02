import { afterEach, expect, it, vi } from 'vitest';
import { MemoryDataSource } from '@nox-map/data-source-static';
import { fixture } from '../../../tests/fixtures.js';
import { AssetLoader } from './assets.js';
afterEach(() => vi.unstubAllGlobals());
it('deduplicates shared images without letting one tile cancel another consumer', async () => {
  vi.stubGlobal('Image', class { src = ''; async decode() {} });
  const provider = new MemoryDataSource([fixture()]); let finish!: (blob: Blob) => void, transport!: AbortSignal;
  const fetch = vi.fn(async (_ref, context) => { transport = context.signal; return new Promise<Blob>(resolve => { finish = resolve; }); });
  provider.fetchAsset = fetch;
  const loader = new AssetLoader(provider, fixture(), 2), first = new AbortController(), second = new AbortController();
  const a = loader.image({ uri: 'shared' }, first.signal), b = loader.image({ uri: 'shared' }, second.signal);
  await Promise.resolve(); const rejected = expect(a).rejects.toMatchObject({ name: 'AbortError' }); first.abort(); await rejected;
  expect(transport.aborted).toBe(false); expect(fetch).toHaveBeenCalledTimes(1);
  finish(new Blob(['image'])); await expect(b).resolves.toBeDefined(); loader.destroy();
});
it('caps concurrent transport and aborts abandoned and queued assets', async () => {
  const provider = new MemoryDataSource([fixture()]); const signals: AbortSignal[] = [];
  provider.fetchAsset = async (_ref, { signal }) => {
    signals.push(signal); return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  };
  const loader = new AssetLoader(provider, fixture(), 1), owner = new AbortController();
  const tasks = [loader.image({ uri: 'a' }, owner.signal), loader.image({ uri: 'b' }), loader.image({ uri: 'c' })];
  const results = Promise.allSettled(tasks); await Promise.resolve(); expect(signals).toHaveLength(1);
  owner.abort(); await vi.waitFor(() => expect(signals).toHaveLength(2)); expect(signals[0].aborted).toBe(true);
  loader.destroy(); expect((await results).every(result => result.status === 'rejected')).toBe(true); expect(signals).toHaveLength(2);
});
