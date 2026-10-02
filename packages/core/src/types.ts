export type Position = [number, number];
export type Bounds = [number, number, number, number];
export type CoordinateSystem = { kind: 'local'; units: string } | { kind: 'geographic'; crs: 'EPSG:4326' };
export type Geometry = { type: 'Point'; coordinates: Position } | { type: 'Polygon'; coordinates: Position[][] } | { type: 'MultiPolygon'; coordinates: Position[][][] };
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface AssetRef { uri: string }
export interface ContentRef { type: string; ref: string; title?: string }
export interface Camera { center: Position; zoom: number }
export interface Paint {
  fill?: string; stroke?: string; strokeWidth?: number; radius?: number;
  icon?: AssetRef; size?: Position; anchor?: Position; textColor?: string;
  font?: string; labelMinZoom?: number; labelMaxZoom?: number; priority?: number;
}
export interface EntityStyle extends Paint { hover?: Paint; selected?: Paint }
export interface Entity {
  id: string; layerId: string; geometry: Geometry; label?: string; description?: string;
  styleId?: string; style?: EntityStyle; metadata?: Record<string, Json>; contentRefs?: ContentRef[];
}
interface RasterPlacement { origin: Position; width: number; height: number; unitsPerPixel: number }
interface SourceCommon { id: string; attribution?: string }
export type RasterSource =
  | (SourceCommon & RasterPlacement & { type: 'image'; asset: AssetRef })
  | (SourceCommon & RasterPlacement & { type: 'raster-pyramid'; template: string; tileSize: number; maxLevel: number })
  | (SourceCommon & { type: 'xyz'; template: string; tileSize: number; minLevel: number; maxLevel: number });
export type MapLayer = {
  id: string; title: string; order: number; visible: boolean; opacity: number;
  style?: EntityStyle; minZoom?: number; maxZoom?: number;
} & ({ type: 'raster'; sourceId: string } | { type: 'vector'; cluster?: false | { distance: number } });
export interface MapSummary { mapId: string; title: string; thumbnail?: AssetRef }
export interface MapSnapshot {
  schemaVersion: 1; mapId: string; snapshotId: string; title: string;
  coordinateSystem: CoordinateSystem; bounds: Bounds; initialView?: Camera;
  minZoom?: number; maxZoom?: number; sources: RasterSource[]; layers: MapLayer[];
  styles?: Record<string, EntityStyle>; entities: Entity[];
}
export interface MapDataSource {
  listMaps(context: { signal: AbortSignal }): Promise<readonly MapSummary[]>;
  getSnapshot(request: { mapId: string; snapshotId?: string }, context: { signal: AbortSignal }): Promise<MapSnapshot>;
  fetchAsset(ref: AssetRef, context: { mapId: string; snapshotId: string; signal: AbortSignal }): Promise<Blob>;
}
export interface ViewState {
  version: 1; mapId: string; snapshotId: string; camera?: Camera;
  selectedEntityId?: string; layers?: Record<string, boolean>;
}
export type ViewCause = 'interaction' | 'api' | 'restore';
export interface LayerState { id: string; visible: boolean; opacity: number }
export interface EngineState {
  mapId?: string; snapshotId?: string; camera?: Camera; selectedEntityId?: string;
  loading: boolean; layers: LayerState[];
}
export interface Hit { entityIds: string[]; cluster: boolean }
export interface EngineEvents {
  loadingchange: { loading: boolean; mapId: string };
  mapchange: { mapId: string; snapshotId: string };
  viewchange: { camera: Camera; cause: ViewCause; settled: boolean };
  layerchange: LayerState;
  entitieschange: { upserted: readonly string[]; removed: readonly string[] };
  selectionchange: { entity?: Entity; cause: ViewCause };
  hoverchange: { entity?: Entity; pixel?: Position };
  clusteractivate: { entities: readonly Entity[] };
  contentactivate: { entity: Entity; content: ContentRef };
  error: { error: Error; recoverable: boolean };
  warning: { code: string; message: string };
}
export interface RendererCallbacks {
  view(camera: Camera, settled: boolean): void;
  click(hits: Hit[]): void;
  hover(hits: Hit[], pixel: Position): void;
  clear(): void;
  error(error: Error): void;
}
export interface RendererPort {
  mount(container: HTMLElement, callbacks: RendererCallbacks): void;
  prepare(snapshot: MapSnapshot, source: MapDataSource): void;
  setView(camera: Camera): void;
  fitBounds(bounds: Bounds, padding?: number): Camera;
  getView(): Camera;
  mapToScreen(position: Position): Position | undefined;
  screenToMap(pixel: Position): Position | undefined;
  pick(pixel: Position): Hit[];
  setLayer(state: LayerState): void;
  select(entity?: Entity): void;
  hover(entity?: Entity): void;
  upsert(entities: readonly Entity[]): void;
  remove(ids: readonly string[]): void;
  destroy(): void;
}
