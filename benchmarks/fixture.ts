import type { MapSnapshot, Entity } from '@nox-map/core';
/** Seeded synthetic data; no domain or backend assumptions. */
export function benchmarkSnapshot(): MapSnapshot {
  let seed = 7043;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const entities: Entity[] = [];
  for (let i = 0; i < 10000; i++) {
    const dense = i < 3000, start = dense ? 20000 : 0, span = dense ? 10000 : 50000;
    entities.push({ id: `p-${i}`, layerId: 'points', label: `Marker ${i}`, geometry: { type: 'Point', coordinates: [start + random() * span, start + random() * span] } });
  }
  for (let i = 0; i < 1000; i++) {
    const x = 500 + random() * 48000, y = 500 + random() * 48000, ring: [number, number][] = [];
    for (let j = 0; j < 100; j++) { const a = j / 100 * Math.PI * 2, radius = 120 + random() * 100; ring.push([x + Math.cos(a) * radius, y + Math.sin(a) * radius]); }
    ring.push([...ring[0]]); entities.push({ id: `r-${i}`, layerId: 'regions', geometry: { type: 'Polygon', coordinates: [ring] }, label: `Region ${i}` });
  }
  return { schemaVersion: 1, mapId: 'benchmark', snapshotId: 'seed-7043', title: 'Benchmark 50k', coordinateSystem: { kind: 'local', units: 'unit' }, bounds: [0, 0, 50000, 50000], initialView: { center: [25000, 25000], zoom: -5 },
    sources: [{ id: 'base', type: 'raster-pyramid', template: '/benchmark/tiles/{z}/{x}/{y}.png', width: 50000, height: 50000, tileSize: 256, unitsPerPixel: 1, origin: [0, 0], maxLevel: 8 }],
    layers: [{ id: 'base', title: 'Raster', type: 'raster', sourceId: 'base', order: 0, visible: true, opacity: 1 }, { id: 'regions', title: '1000 regions', type: 'vector', order: 1, visible: true, opacity: .7 }, { id: 'points', title: '10000 points', type: 'vector', order: 2, visible: true, opacity: 1, cluster: { distance: 40 }, style: { labelMinZoom: -2 } }], entities };
}
