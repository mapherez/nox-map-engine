import { en as locale } from './locales/en.js';
import type { Entity, Json } from './types.js';
import { entitySchema, MapError, validateGeographicPosition, positions } from './validation.js';
export function importGeoJSON(input: unknown, options: { layerId: string; id?: (feature: Record<string, unknown>, index: number) => string }): Entity[] {
  if (!input || typeof input !== 'object' || (input as Record<string, unknown>).type !== 'FeatureCollection' || !Array.isArray((input as Record<string, unknown>).features)) throw new MapError('INVALID_GEOJSON', locale.expectedFeatureCollection);
  if ('crs' in input) throw new MapError('INVALID_GEOJSON', locale.unsupportedGeoJsonCrs);
  const ids = new Set<string>();
  return ((input as { features: Record<string, unknown>[] }).features).map((f, index) => {
    if (f.type !== 'Feature') throw new MapError('INVALID_GEOJSON', locale.expectedFeature);
    const id = options.id?.(f, index) ?? (typeof f.id === 'string' || typeof f.id === 'number' ? String(f.id) : undefined);
    if (!id || ids.has(id)) throw new MapError('INVALID_GEOJSON', locale.featureNeedsUniqueId);
    ids.add(id);
    const metadata = f.properties ?? {};
    const entity = entitySchema.parse({ id, layerId: options.layerId, geometry: f.geometry, metadata }) as Entity;
    for (const p of positions(entity)) validateGeographicPosition(p);
    const g = entity.geometry;
    const rings = g.type === 'Point' ? [] : g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
    if (rings.some(r => r.some((p, i) => i > 0 && Math.abs(p[0] - r[i - 1][0]) > 180))) throw new MapError('ANTIMERIDIAN', locale.geometryCrossesAntimeridian);
    const label = (metadata as Record<string, Json>).name;
    if (typeof label === 'string') entity.label = label;
    return entity;
  });
}
