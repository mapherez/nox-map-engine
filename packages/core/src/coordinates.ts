import type { Bounds, Camera, CoordinateSystem, Entity, Position } from './types.js';
import { positions } from './validation.js';
export const EARTH_RADIUS = 6378137;
export const MERCATOR_ZERO_RESOLUTION = 2 * Math.PI * EARTH_RADIUS / 256;
export function project(p: Position, cs: CoordinateSystem): Position {
  if (cs.kind === 'local') return [p[0], -p[1]];
  return [EARTH_RADIUS * p[0] * Math.PI / 180, EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + p[1] * Math.PI / 360))];
}
export function unproject(p: Position, cs: CoordinateSystem): Position {
  if (cs.kind === 'local') return [p[0], -p[1]];
  return [p[0] / EARTH_RADIUS * 180 / Math.PI, (2 * Math.atan(Math.exp(p[1] / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI];
}
export function projectBounds(b: Bounds, cs: CoordinateSystem): Bounds {
  const a = project([b[0], b[1]], cs), c = project([b[2], b[3]], cs);
  return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])];
}
export function zoomResolution(zoom: number, cs: CoordinateSystem): number { return (cs.kind === 'local' ? 1 : MERCATOR_ZERO_RESOLUTION) / 2 ** zoom; }
export function resolutionZoom(resolution: number, cs: CoordinateSystem): number { return Math.log2((cs.kind === 'local' ? 1 : MERCATOR_ZERO_RESOLUTION) / resolution); }
export function coordinateToScreen(p: Position, camera: Camera, size: Position, cs: CoordinateSystem): Position {
  const a = project(p, cs), c = project(camera.center, cs), r = zoomResolution(camera.zoom, cs);
  return [size[0] / 2 + (a[0] - c[0]) / r, size[1] / 2 - (a[1] - c[1]) / r];
}
export function screenToCoordinate(p: Position, camera: Camera, size: Position, cs: CoordinateSystem): Position {
  const c = project(camera.center, cs), r = zoomResolution(camera.zoom, cs);
  return unproject([c[0] + (p[0] - size[0] / 2) * r, c[1] - (p[1] - size[1] / 2) * r], cs);
}
export function entityBounds(entity: Entity): Bounds {
  const p = positions(entity); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of p) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return [minX, minY, maxX, maxY];
}
