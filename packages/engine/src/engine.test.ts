import { describe, it, expect } from 'vitest';
import { fixture } from '../../../tests/fixtures.js';
import { MemoryDataSource } from '@nox-map/data-source-static';
import type { Bounds, Camera, MapDataSource, MapSnapshot, RendererPort } from '@nox-map/core';
import { createMapEngine } from './index.js';
class FakeRenderer implements RendererPort {
  camera: Camera = { center: [0, 0], zoom: 0 }; selected?: string; prepared?: MapSnapshot; destroyed = 0;
  mount() {} prepare(snapshot: MapSnapshot) { this.prepared = snapshot; }
  setView(camera: Camera) { this.camera = structuredClone(camera); }
  getView() { return structuredClone(this.camera); }
  fitBounds(bounds: Bounds) { this.camera = { center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], zoom: -1 }; return this.getView(); }
  mapToScreen() { return [0, 0] as [number, number]; } screenToMap() { return [0, 0] as [number, number]; }
  pick() { return []; } setLayer() {} select(entity?: { id: string }) { this.selected = entity?.id; } hover() {} upsert() {} remove() {} destroy() { this.destroyed++; }
}
function setup(source: MapDataSource = new MemoryDataSource([fixture()])) {
  const renderer = new FakeRenderer(); const engine = createMapEngine({ container: {} as HTMLElement, dataSource: source, renderer }); return { renderer, engine };
}
describe('engine lifecycle and state', () => {
  it('applies viewport precedence including entity focus without an explicit camera', async () => {
    const { engine } = setup(); await engine.loadMap('local'); expect(engine.getState().camera).toEqual(fixture().initialView);
    await engine.loadMap('local', { initialView: { center: [20, 30], zoom: 2 } }); expect(engine.getState().camera?.center).toEqual([20, 30]);
    await engine.applyViewState({ version: 1, mapId: 'local', snapshotId: 'base', selectedEntityId: 'point', camera: { center: [50, 60], zoom: 1 } }); expect(engine.getState().camera?.center).toEqual([50, 60]);
    await engine.applyViewState({ version: 1, mapId: 'local', snapshotId: 'base', selectedEntityId: 'point', layers: { points: false } }); expect(engine.getState().camera?.center).toEqual([500, 400]); expect(engine.getLayers()[1].visible).toBe(true);
    engine.destroy();
  });
  it('preserves the active map when a replacement fails validation', async () => {
    const valid = fixture(), invalid = { ...fixture('broken'), schemaVersion: 3 };
    const source = new MemoryDataSource([valid]); const original = source.getSnapshot.bind(source);
    source.getSnapshot = async (request, context) => request.mapId === 'broken' ? invalid as MapSnapshot : original(request, context);
    const { engine } = setup(source); await engine.loadMap('local'); await expect(engine.loadMap('broken')).rejects.toThrow(); expect(engine.getState().mapId).toBe('local'); engine.destroy();
  });
  it('ignores superseded loads even when the source ignores cancellation', async () => {
    const source = new MemoryDataSource([fixture(), fixture('new')]); let release!: (s: MapSnapshot) => void;
    source.getSnapshot = async request => request.mapId === 'local' ? new Promise(resolve => { release = resolve; }) : fixture('new');
    const { engine } = setup(source); const old = engine.loadMap('local'); const rejection = expect(old).rejects.toThrow(); await engine.loadMap('new'); release(fixture()); await rejection; expect(engine.getState().mapId).toBe('new'); engine.destroy();
  });
  it('validates the whole update before applying and clears selection on hide/remove', async () => {
    const { engine } = setup(); await engine.loadMap('local'); engine.selectEntity('point'); engine.setLayerVisibility('points', false); expect(engine.getState().selectedEntityId).toBeUndefined();
    engine.selectEntity('point'); const original = engine.getEntity('point')!;
    expect(() => engine.upsertEntities([{ ...original, label: 'Updated' }, { ...original, id: 'bad', layerId: 'missing' }])).toThrow(); expect(engine.getEntity('point')?.label).toBe(original.label);
    engine.upsertEntities([{ ...original, label: 'Updated' }]); expect(engine.getEntity('point')?.label).toBe('Updated'); expect(engine.getState().snapshotId).toBe('base');
    engine.removeEntities(['point']); expect(engine.getState().selectedEntityId).toBeUndefined(); await engine.loadMap('local'); expect(engine.getEntity('point')?.label).toBe(original.label); engine.destroy();
  });
  it('returns defensive copies and cleans up idempotently', async () => {
    const { engine, renderer } = setup(); await engine.loadMap('local'); const entity = engine.getEntity('point')!; entity.metadata!.nested = false; expect(engine.getEntity('point')?.metadata?.nested).toEqual({ useful: true });
    engine.destroy(); engine.destroy(); expect(renderer.destroyed).toBe(1); expect(() => engine.getState()).toThrow('destroyed');
  });
  it('emits a recoverable warning for missing link entities', async () => {
    const { engine } = setup(); const warnings: string[] = []; engine.on('warning', event => warnings.push(event.code));
    await engine.applyViewState({ version: 1, mapId: 'local', snapshotId: 'base', selectedEntityId: 'missing' }); expect(engine.getState().mapId).toBe('local'); expect(warnings).toContain('ENTITY_NOT_FOUND'); engine.destroy();
  });
  it('ignores a geographic link camera outside the supported domain', async () => {
    const map = fixture('geo'); map.coordinateSystem = { kind: 'geographic', crs: 'EPSG:4326' };
    map.bounds = [-10, 38, -9, 39]; map.initialView = { center: [-9.5, 38.5], zoom: 10 }; map.entities = [];
    const { engine } = setup(new MemoryDataSource([map])); const warnings: string[] = [];
    engine.on('warning', event => warnings.push(event.code));
    await engine.applyViewState({ version: 1, mapId: 'geo', snapshotId: 'base', camera: { center: [181, 38], zoom: 10 } });
    expect(engine.getState().mapId).toBe('geo'); expect(engine.getState().camera).toEqual(map.initialView); expect(warnings).toContain('INVALID_LINK_FIELD');
    expect(() => engine.setView({ center: [0, 90], zoom: 10 })).toThrow('Mercator'); engine.destroy();
  });
});
