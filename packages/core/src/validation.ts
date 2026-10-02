import { z } from 'zod';
import type { Entity, MapSnapshot } from './types.js';
const num = z.number().finite();
const id = z.string().min(1).max(256);
export const positionSchema = z.tuple([num, num]);
const boundsSchema = z.tuple([num, num, num, num]).refine(b => b[0] < b[2] && b[1] < b[3], 'Bounds must have positive width and height');
export const cameraSchema = z.object({ center: positionSchema, zoom: num.min(-40).max(40) });
const asset = z.object({ uri: z.string().min(1) });
const paintFields = {
  fill: z.string().optional(), stroke: z.string().optional(), strokeWidth: num.nonnegative().optional(),
  radius: num.positive().optional(), icon: asset.optional(), size: positionSchema.refine(p => p.every(n => n > 0)).optional(),
  anchor: positionSchema.optional(), textColor: z.string().optional(), font: z.string().optional(),
  labelMinZoom: num.optional(), labelMaxZoom: num.optional(), priority: num.optional()
};
const paint = z.object(paintFields);
const style = z.object({ ...paintFields, hover: paint.optional(), selected: paint.optional() });
const ring = z.array(positionSchema).min(4).refine(r => r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1], 'Polygon rings must be closed');
const polygon = z.array(ring).min(1);
export const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: positionSchema }),
  z.object({ type: z.literal('Polygon'), coordinates: polygon }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).min(1) })
]);
export const entitySchema = z.object({
  id, layerId: id, geometry: geometrySchema, label: z.string().optional(), description: z.string().optional(),
  styleId: id.optional(), style: style.optional(), metadata: z.record(z.string(), z.json()).optional(),
  contentRefs: z.array(z.object({ type: id, ref: z.string().min(1), title: z.string().optional() })).optional()
});
const placement = { origin: positionSchema, width: num.int().positive(), height: num.int().positive(), unitsPerPixel: num.positive() };
const sourceCommon = { id, attribution: z.string().optional() };
const template = z.string().refine(s => ['{z}', '{x}', '{y}'].every(t => s.includes(t)), 'Template needs {z}, {x}, {y}');
const tileSize = z.union([z.literal(256), z.literal(512)]);
const level = num.int().min(0).max(30);
const sourceSchema = z.discriminatedUnion('type', [
  z.object({ ...sourceCommon, ...placement, type: z.literal('image'), asset }),
  z.object({ ...sourceCommon, ...placement, type: z.literal('raster-pyramid'), template, tileSize, maxLevel: level }),
  z.object({ ...sourceCommon, type: z.literal('xyz'), template, tileSize, minLevel: level, maxLevel: level })
]);
const layerCommon = { id, title: id, order: num, visible: z.boolean(), opacity: num.min(0).max(1), style: style.optional(), minZoom: num.optional(), maxZoom: num.optional() };
const layerSchema = z.discriminatedUnion('type', [
  z.object({ ...layerCommon, type: z.literal('raster'), sourceId: id }),
  z.object({ ...layerCommon, type: z.literal('vector'), cluster: z.union([z.literal(false), z.object({ distance: num.positive() })]).optional() })
]);
export const snapshotSchema = z.object({
  schemaVersion: z.literal(1), mapId: id, snapshotId: id, title: id,
  coordinateSystem: z.discriminatedUnion('kind', [z.object({ kind: z.literal('local'), units: id }), z.object({ kind: z.literal('geographic'), crs: z.literal('EPSG:4326') })]),
  bounds: boundsSchema, initialView: cameraSchema.optional(), minZoom: num.min(-40).optional(), maxZoom: num.max(40).optional(),
  sources: z.array(sourceSchema), layers: z.array(layerSchema), styles: z.record(z.string(), style).optional(), entities: z.array(entitySchema)
});
export class MapError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'MapError'; }
}
export function validateSnapshot(input: unknown): MapSnapshot {
  assertSerializable(input);
  const result = snapshotSchema.safeParse(input);
  if (!result.success) throw new MapError('INVALID_SNAPSHOT', result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  const s = result.data as MapSnapshot;
  for (const items of [s.sources, s.layers, s.entities]) {
    const ids = new Set<string>();
    for (const item of items) { if (ids.has(item.id)) throw new MapError('DUPLICATE_ID', `Duplicate ID: ${item.id}`); ids.add(item.id); }
  }
  if ((s.minZoom ?? -40) > (s.maxZoom ?? 40)) throw new MapError('INVALID_ZOOM', 'minZoom exceeds maxZoom');
  for (const source of s.sources) {
    if ((source.type === 'xyz') !== (s.coordinateSystem.kind === 'geographic')) throw new MapError('INCOMPATIBLE_SOURCE', `Source ${source.id} is incompatible with map coordinates`);
    if (source.type === 'xyz' && source.minLevel > source.maxLevel) throw new MapError('INVALID_SOURCE', 'minLevel exceeds maxLevel');
    if (source.type === 'image' && source.width * source.height > 16_777_216) throw new MapError('IMAGE_TOO_LARGE', 'Prepare this image as a raster-pyramid (small images are limited to 16M pixels)');
  }
  for (const layer of s.layers) {
    if (layer.type === 'raster' && !s.sources.some(source => source.id === layer.sourceId)) throw new MapError('MISSING_SOURCE', `Layer ${layer.id}: source not found`);
    if ((layer.minZoom ?? -40) > (layer.maxZoom ?? 40)) throw new MapError('INVALID_ZOOM', `Layer ${layer.id}: inverted zoom range`);
  }
  for (const entity of s.entities) validateEntityContext(entity, s);
  if (s.coordinateSystem.kind === 'geographic') {
    validateGeographicPosition([s.bounds[0], s.bounds[1]]); validateGeographicPosition([s.bounds[2], s.bounds[3]]);
    if (s.initialView) validateGeographicPosition(s.initialView.center);
  }
  return s;
}
export function positions(entity: Entity): [number, number][] {
  const g = entity.geometry;
  return g.type === 'Point' ? [g.coordinates] : g.type === 'Polygon' ? g.coordinates.flat() : g.coordinates.flat(2);
}
export function validateGeographicPosition(p: [number, number]): void {
  if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85.0511287798066) throw new MapError('UNSUPPORTED_COORDINATE', 'Coordinates exceed the Web Mercator domain');
}
export function validateEntityContext(entity: Entity, snapshot: MapSnapshot): void {
  const layer = snapshot.layers.find(l => l.id === entity.layerId);
  if (!layer || layer.type !== 'vector') throw new MapError('MISSING_LAYER', `Entity ${entity.id}: vector layer not found`);
  if (entity.styleId && !snapshot.styles?.[entity.styleId]) throw new MapError('MISSING_STYLE', `Entity ${entity.id}: style not found`);
  if (snapshot.coordinateSystem.kind === 'geographic') {
    for (const p of positions(entity)) validateGeographicPosition(p);
    const g = entity.geometry;
    const rings = g.type === 'Point' ? [] : g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
    if (rings.some(r => r.some((p, i) => i > 0 && Math.abs(p[0] - r[i - 1][0]) > 180))) throw new MapError('ANTIMERIDIAN', `Entity ${entity.id}: antimeridian crossings are unsupported`);
  }
}
export function validateEntities(input: readonly Entity[], snapshot: MapSnapshot): Entity[] {
  assertSerializable(input);
  const output: Entity[] = []; const ids = new Set<string>();
  for (const value of input) {
    const entity = entitySchema.parse(value) as Entity;
    if (ids.has(entity.id)) throw new MapError('DUPLICATE_ID', `Duplicate ID in update: ${entity.id}`);
    ids.add(entity.id); validateEntityContext(entity, snapshot); output.push(entity);
  }
  return output;
}
function assertSerializable(input: unknown): void {
  try { JSON.stringify(input); } catch { throw new MapError('INVALID_JSON', 'Map data must be JSON-serializable and cannot contain cycles'); }
}
