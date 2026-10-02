import { describe, it, expect } from 'vitest';
import type { MapDataSource } from '@nox-map/core';
/** Reuse this contract when adding a backend adapter, including NoX Sync. */
export function dataSourceContract(name: string, factory: () => MapDataSource): void {
  describe(`${name} data source contract`, () => {
    it('lists maps and resolves a concrete current snapshot', async () => {
      const source = factory(), context = { signal: new AbortController().signal };
      const maps = await source.listMaps(context); expect(maps[0].mapId).toBe('local');
      const current = await source.getSnapshot({ mapId: maps[0].mapId }, context);
      expect(current.snapshotId).toBe('base'); expect(await source.getSnapshot({ mapId: 'local', snapshotId: 'base' }, context)).toEqual(current);
    });
    it('rejects missing maps/snapshots/assets', async () => {
      const source = factory(), context = { signal: new AbortController().signal };
      await expect(source.getSnapshot({ mapId: 'missing' }, context)).rejects.toThrow();
      await expect(source.getSnapshot({ mapId: 'local', snapshotId: 'missing' }, context)).rejects.toThrow();
      await expect(source.fetchAsset({ uri: 'missing.png' }, { ...context, mapId: 'local', snapshotId: 'base' })).rejects.toThrow();
    });
    it('honours cancellation and returns isolated snapshots', async () => {
      const source = factory(), controller = new AbortController(); controller.abort();
      await expect(source.listMaps({ signal: controller.signal })).rejects.toThrow();
      await expect(source.getSnapshot({ mapId: 'local' }, { signal: controller.signal })).rejects.toThrow();
      await expect(source.fetchAsset({ uri: 'tile.png' }, { mapId: 'local', snapshotId: 'base', signal: controller.signal })).rejects.toThrow();
      const context = { signal: new AbortController().signal }, a = await source.getSnapshot({ mapId: 'local' }, context);
      a.entities[0].label = 'Mutated'; expect((await source.getSnapshot({ mapId: 'local' }, context)).entities[0].label).not.toBe('Mutated');
    });
  });
}
