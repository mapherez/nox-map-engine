import { MemoryDataSource, StaticHttpDataSource } from '@nox-map/data-source-static';
import type { MapDataSource } from '@nox-map/core';
import { startViewer } from './viewer';
import { en as locale } from './locales/en';
export type ProviderFactory = (config: Record<string, unknown>, baseUrl: URL) => MapDataSource | Promise<MapDataSource>;
/** Add backend factories here or inject them from an alternate application entry. */
export async function bootstrapViewer(providers: Record<string, ProviderFactory> = {}): Promise<() => void> {
  const configUrl = new URL('./config.json', document.baseURI);
  const response = await fetch(configUrl); if (!response.ok) throw new Error(locale.configUnavailable);
  const config = await response.json() as Record<string, unknown>;
  if (config.gestures !== undefined && !['exclusive', 'cooperative'].includes(config.gestures as string)) throw new Error(locale.invalidGestures);
  const registry: Record<string, ProviderFactory> = {
    'static-http': (settings, base) => {
      if (typeof settings.catalogUrl !== 'string') throw new Error(locale.missingCatalogUrl);
      return new StaticHttpDataSource({ catalogUrl: new URL(settings.catalogUrl, base).href });
    }, ...providers
  };
  const name = typeof config.provider === 'string' ? config.provider : 'static-http';
  if (!Object.hasOwn(registry, name)) throw new Error(locale.unknownProvider(name));
  let dataSource = await registry[name](config, configUrl);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('benchmark')) {
    const { benchmarkSnapshot } = await import('../../../benchmarks/fixture');
    const source = new MemoryDataSource([benchmarkSnapshot()]);
    source.fetchAsset = async (ref, context) => { const res = await fetch(ref.uri, { signal: context.signal }); if (!res.ok) throw new Error(locale.tileNotFound); return res.blob(); };
    dataSource = source;
  }
  return startViewer({ dataSource, gestures: config.gestures as 'exclusive' | 'cooperative' | undefined });
}
