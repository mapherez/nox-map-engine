import type { MapSnapshot } from '@nox-map/core';
export function fixture(mapId = 'local'): MapSnapshot {
  return {
    schemaVersion: 1, mapId, snapshotId: 'base', title: 'Local atlas', coordinateSystem: { kind: 'local', units: 'unit' },
    bounds: [0, 0, 1000, 800], initialView: { center: [500, 400], zoom: 0 }, sources: [],
    layers: [
      { id: 'regions', title: 'Regions', type: 'vector', order: 1, visible: true, opacity: 1 },
      { id: 'points', title: 'Points of interest', type: 'vector', order: 2, visible: true, opacity: 1 }
    ],
    entities: [
      { id: 'point', layerId: 'points', geometry: { type: 'Point', coordinates: [500, 400] }, label: 'Central point', metadata: { nested: { useful: true } } },
      { id: 'region', layerId: 'regions', geometry: { type: 'Polygon', coordinates: [[[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]], [[150, 150], [250, 150], [250, 250], [150, 250], [150, 150]]] }, label: 'Region with a hole' }
    ]
  };
}
