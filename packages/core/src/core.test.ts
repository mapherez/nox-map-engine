import { describe, it, expect } from 'vitest';
import { fixture } from '../../../tests/fixtures.js';
import { validateSnapshot, validateEntities, project, unproject, coordinateToScreen, screenToCoordinate, zoomResolution, resolutionZoom, parseViewState, serializeViewState, importGeoJSON } from './index.js';
describe('map model', () => {
  it('accepts local coordinates independent of raster pixels', () => {
    const map = fixture(); map.sources = [{ id: 'raster', type: 'raster-pyramid', width: 50000, height: 50000, unitsPerPixel: .02, origin: [0, 0], tileSize: 256, maxLevel: 8, template: '/{z}/{x}/{y}.png' }];
    expect(validateSnapshot(map).sources[0].type).toBe('raster-pyramid');
  });
  it.each(['entities', 'layers', 'sources'] as const)('rejects duplicate %s IDs', key => {
    const map = fixture();
    if (key === 'sources') map.sources = [{ id: 'image', type: 'image', width: 10, height: 10, origin: [0, 0], unitsPerPixel: 1, asset: { uri: '/image.png' } }];
    (map[key] as unknown[]).push(map[key][0]); expect(() => validateSnapshot(map)).toThrow('Duplicate ID');
  });
  it('rejects open polygon rings and missing references', () => {
    const map = fixture(); (map.entities[1].geometry as { coordinates: number[][][] }).coordinates[0].pop(); expect(() => validateSnapshot(map)).toThrow('closed');
    expect(() => validateEntities([{ ...fixture().entities[0], layerId: 'missing' }], fixture())).toThrow('layer not found');
  });
  it('rejects incompatible sources, huge single images, invalid metadata and non-finite coordinates', () => {
    const map = fixture(); map.sources = [{ id: 'geo', type: 'xyz', template: '/{z}/{x}/{y}', tileSize: 256, minLevel: 0, maxLevel: 10 }]; expect(() => validateSnapshot(map)).toThrow('incompatible');
    map.sources = [{ id: 'huge', type: 'image', width: 50000, height: 50000, origin: [0, 0], unitsPerPixel: 1, asset: { uri: 'x' } }]; expect(() => validateSnapshot(map)).toThrow('raster-pyramid');
    const bad = fixture(); bad.entities[0].metadata = { value: (() => {}) as never }; expect(() => validateSnapshot(bad)).toThrow();
    expect(() => validateEntities([{ ...fixture().entities[0], geometry: { type: 'Point', coordinates: [NaN, 0] } }], fixture())).toThrow();
  });
  it('validates the Mercator domain and antimeridian crossings', () => {
    const map = fixture(); map.coordinateSystem = { kind: 'geographic', crs: 'EPSG:4326' }; map.bounds = [-180, -80, 180, 80]; map.initialView = undefined;
    map.entities = [{ id: 'date', layerId: 'regions', geometry: { type: 'Polygon', coordinates: [[[179, 0], [-179, 0], [-179, 1], [179, 0]]] } }];
    expect(() => validateSnapshot(map)).toThrow('antimeridian');
    map.entities = [{ id: 'pole', layerId: 'points', geometry: { type: 'Point', coordinates: [0, 90] } }]; expect(() => validateSnapshot(map)).toThrow('Mercator');
  });
});
describe('coordinates', () => {
  it.each([{ kind: 'local', units: 'u' } as const, { kind: 'geographic', crs: 'EPSG:4326' } as const])('round-trips projection and CSS screen coordinates for $kind', cs => {
    const p: [number, number] = cs.kind === 'local' ? [340.2, 470.1] : [-9.14, 38.72];
    const projected = project(p, cs), restored = unproject(projected, cs);
    expect(restored[0]).toBeCloseTo(p[0], 8); expect(restored[1]).toBeCloseTo(p[1], 8);
    const camera = { center: p, zoom: cs.kind === 'local' ? -1.3 : 8.3 }; const pixel: [number, number] = [173.2, 222.5];
    const result = coordinateToScreen(screenToCoordinate(pixel, camera, [1280, 800], cs), camera, [1280, 800], cs);
    expect(result[0]).toBeCloseTo(pixel[0], 6); expect(result[1]).toBeCloseTo(pixel[1], 6);
    expect(resolutionZoom(zoomResolution(camera.zoom, cs), cs)).toBeCloseTo(camera.zoom);
    expect(zoomResolution(camera.zoom + 1, cs)).toBe(zoomResolution(camera.zoom, cs) / 2);
  });
  it('uses top-left y-down local coordinates', () => expect(project([2, 3], { kind: 'local', units: 'u' })).toEqual([2, -3]));
});
describe('links and GeoJSON', () => {
  it('round-trips unicode IDs, camera and visibility without transport credentials', () => {
    const state = { version: 1 as const, mapId: '世界 / mapa', snapshotId: 'base', camera: { center: [2, 3] as [number, number], zoom: -2.3 }, selectedEntityId: 'árvore', layers: { points: false } };
    expect(parseViewState(serializeViewState(state))).toEqual({ state, diagnostics: [] });
    expect(serializeViewState({ ...state, secret: 'token' } as typeof state)).not.toContain('token');
  });
  it('ignores malformed optional fields and rejects missing identities', () => {
    const result = parseViewState(encodeURIComponent(JSON.stringify({ version: 1, mapId: 'map', snapshotId: 'base', camera: { zoom: 'bad' }, layers: { valid: false, invalid: 'yes' } })));
    expect(result.state.camera).toBeUndefined(); expect(result.state.layers).toEqual({ valid: false }); expect(result.diagnostics).toHaveLength(2);
    expect(() => parseViewState('#noxMap=%oops')).toThrow('Malformed'); expect(() => parseViewState(encodeURIComponent('{}'))).toThrow('identity');
  });
  it('requires stable feature IDs and geographic coordinates', () => {
    const data = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'site', geometry: { type: 'Point', coordinates: [-9, 38] }, properties: { name: 'Site' } }] };
    expect(importGeoJSON(data, { layerId: 'points' })[0].label).toBe('Site');
    delete (data.features[0] as { id?: string }).id;
    expect(() => importGeoJSON(data, { layerId: 'points' })).toThrow('stable ID');
    expect(importGeoJSON(data, { layerId: 'points', id: () => 'external-id' })[0].id).toBe('external-id');
  });
});
