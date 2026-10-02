import { it, expect } from 'vitest';
import { dataSourceContract } from '../../../tests/data-source-contract.js';
import { fixture } from '../../../tests/fixtures.js';
import { MemoryDataSource, StaticHttpDataSource } from './index.js';
const catalog = { maps: [{ mapId: 'local', title: 'Local', currentSnapshotId: 'base', snapshots: { base: './local/map.json' } }] };
const request = async (url: string) => {
  if (url.endsWith('/catalog.json')) return Response.json(catalog);
  if (url.endsWith('/local/map.json')) return Response.json({ ...fixture(), entities: undefined, entitiesUrl: './entities.json' });
  if (url.endsWith('/local/entities.json')) return Response.json(fixture().entities);
  return new Response(null, { status: 404 });
};
dataSourceContract('Memory', () => new MemoryDataSource([fixture()]));
dataSourceContract('Static HTTP', () => new StaticHttpDataSource({ catalogUrl: 'https://maps.example/catalog.json', request }));
it('resolves relative assets and template tokens without embedding auth in the manifest', async () => {
  const map = fixture(); map.sources = [{ id: 'base', type: 'raster-pyramid', template: './tiles/{z}/{x}/{y}.png', width: 50000, height: 50000, unitsPerPixel: .02, origin: [0, 0], tileSize: 256, maxLevel: 8 }];
  const source = new StaticHttpDataSource({ catalogUrl: 'https://maps.example/catalog.json', request: async url => url.endsWith('/catalog.json') ? Response.json(catalog) : Response.json(map) });
  const snapshot = await source.getSnapshot({ mapId: 'local' }, { signal: new AbortController().signal });
  expect(snapshot.sources[0]).toHaveProperty('template', 'https://maps.example/local/tiles/{z}/{x}/{y}.png');
});
it('does not treat an auth failure as an empty map', async () => {
  const source = new StaticHttpDataSource({ catalogUrl: 'https://maps.example/catalog.json', request: async () => new Response(null, { status: 401 }) });
  await expect(source.listMaps({ signal: new AbortController().signal })).rejects.toHaveProperty('code', 'UNAUTHORIZED');
});
