import {
  cameraSchema, entityBounds, MapError, parseViewState, serializeViewState, validateEntities,
  validateGeographicPosition, validateSnapshot,
  type Bounds, type Camera, type ContentRef, type EngineEvents, type EngineState, type Entity,
  type Hit, type LayerState, type MapDataSource, type MapLayer, type MapSnapshot, type Position,
  type RendererPort, type ViewCause, type ViewState
} from '@nox-map/core';
import { OpenLayersRenderer } from '@nox-map/renderer-openlayers';
export type { EngineEvents, EngineState, Entity, MapDataSource, MapSnapshot, ViewState } from '@nox-map/core';
export { parseViewState, serializeViewState } from '@nox-map/core';
export interface EngineOptions {
  container: HTMLElement; dataSource: MapDataSource;
  gestures?: 'exclusive' | 'cooperative'; profile?: 'desktop' | 'mobile'; maxPixelRatio?: number;
  /** Optional renderer port for alternate implementations; no OpenLayers types. */
  renderer?: RendererPort;
  style?: import('@nox-map/renderer-openlayers').StyleResolver;
}
export interface LoadOptions { snapshotId?: string; initialView?: Camera; viewState?: ViewState }
type Listener<K extends keyof EngineEvents> = (event: EngineEvents[K]) => void;
export class MapEngine {
  private snapshot?: MapSnapshot;
  private entities = new Map<string, Entity>();
  private layers = new Map<string, LayerState>();
  private selected?: string;
  private listeners = new Map<keyof EngineEvents, Set<(event: never) => void>>();
  private loading?: AbortController;
  private generation = 0;
  private dead = false;
  private suppressView = false;
  private renderer: RendererPort;
  constructor(private options: EngineOptions) {
    if (options.maxPixelRatio !== undefined && (!Number.isFinite(options.maxPixelRatio) || options.maxPixelRatio <= 0)) throw new MapError('INVALID_PIXEL_RATIO', 'maxPixelRatio must be finite and positive');
    this.renderer = options.renderer ?? new OpenLayersRenderer({ gestures: options.gestures, profile: options.profile, maxPixelRatio: options.maxPixelRatio, style: options.style });
    this.renderer.mount(options.container, {
      view: (camera, settled) => { if (!this.suppressView && this.snapshot) this.emit('viewchange', { camera, cause: 'interaction', settled }); },
      click: hits => this.click(hits),
      hover: (hits, pixel) => {
        const hit = hits[0]; const entity = hit && !hit.cluster ? this.entities.get(hit.entityIds[0]) : undefined;
        this.renderer.hover(entity); this.emit('hoverchange', { entity: entity ? structuredClone(entity) : undefined, pixel });
      },
      clear: () => this.clearSelection('interaction'),
      error: error => this.emit('error', { error, recoverable: true })
    });
  }
  private assertAlive(): void { if (this.dead) throw new MapError('DESTROYED', 'Engine has been destroyed'); }
  private active(): MapSnapshot { this.assertAlive(); if (!this.snapshot) throw new MapError('NO_MAP', 'Load a map first'); return this.snapshot; }
  on<K extends keyof EngineEvents>(type: K, listener: Listener<K>): () => void {
    this.assertAlive(); let set = this.listeners.get(type);
    if (!set) { set = new Set(); this.listeners.set(type, set); }
    const fn = listener as (event: never) => void; set.add(fn); return () => set!.delete(fn);
  }
  private emit<K extends keyof EngineEvents>(type: K, event: EngineEvents[K]): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      try { fn(event as never); } catch (error) { console.error(`NoX Map ${type} listener failed`, error); }
    }
  }
  async loadMap(mapId: string, options: LoadOptions = {}): Promise<void> {
    this.assertAlive(); const generation = ++this.generation;
    this.loading?.abort(); const controller = new AbortController(); this.loading = controller;
    this.emit('loadingchange', { loading: true, mapId });
    try {
      const parsedRestored = options.viewState ? parseViewState(encodeURIComponent(JSON.stringify(options.viewState))) : undefined;
      for (const message of parsedRestored?.diagnostics ?? []) this.emit('warning', { code: 'INVALID_LINK_FIELD', message });
      const restored = parsedRestored?.state;
      if (restored && restored.mapId !== mapId) throw new MapError('IDENTITY_MISMATCH', 'View state belongs to another map');
      const requestedSnapshot = restored?.snapshotId ?? options.snapshotId;
      const snapshot = validateSnapshot(await this.options.dataSource.getSnapshot({ mapId, snapshotId: requestedSnapshot }, { signal: controller.signal }));
      controller.signal.throwIfAborted();
      if (generation !== this.generation || this.dead) throw new DOMException('Superseded map load', 'AbortError');
      if (snapshot.mapId !== mapId || (requestedSnapshot && snapshot.snapshotId !== requestedSnapshot)) throw new MapError('IDENTITY_MISMATCH', 'Data source returned the wrong snapshot');
      if (restored?.camera && snapshot.coordinateSystem.kind === 'geographic') {
        try { validateGeographicPosition(restored.camera.center); }
        catch { restored.camera = undefined; this.emit('warning', { code: 'INVALID_LINK_FIELD', message: 'Ignored camera outside the Web Mercator domain' }); }
      }
      const camera = restored?.camera ?? options.initialView ?? snapshot.initialView;
      if (camera) { cameraSchema.parse(camera); if (snapshot.coordinateSystem.kind === 'geographic') validateGeographicPosition(camera.center); }
      // Renderer builds replacement layers before disposing the active ones.
      this.suppressView = true;
      this.renderer.prepare(snapshot, this.options.dataSource);
      this.snapshot = snapshot; this.entities = new Map(snapshot.entities.map(e => [e.id, e]));
      this.layers = new Map(snapshot.layers.map(l => [l.id, { id: l.id, visible: restored?.layers?.[l.id] ?? l.visible, opacity: l.opacity }]));
      this.selected = undefined;
      for (const state of this.layers.values()) this.renderer.setLayer(state);
      if (camera) this.renderer.setView(camera); else this.renderer.fitBounds(snapshot.bounds);
      if (restored?.selectedEntityId) {
        if (this.entities.has(restored.selectedEntityId)) {
          this.selectEntity(restored.selectedEntityId, 'restore');
          if (!restored.camera) this.focusEntity(restored.selectedEntityId, 'restore');
        } else this.emit('warning', { code: 'ENTITY_NOT_FOUND', message: `Entity ${restored.selectedEntityId} no longer exists` });
      }
      this.suppressView = false;
      this.emit('mapchange', { mapId: snapshot.mapId, snapshotId: snapshot.snapshotId });
      this.emit('selectionchange', { entity: this.getSelected(), cause: restored ? 'restore' : 'api' });
      this.emit('viewchange', { camera: this.renderer.getView(), cause: restored ? 'restore' : 'api', settled: true });
    } catch (error) {
      if (!controller.signal.aborted && generation === this.generation && !this.dead) this.emit('error', { error: error instanceof Error ? error : new Error(String(error)), recoverable: true });
      throw error;
    } finally {
      this.suppressView = false;
      if (generation === this.generation && !this.dead) { this.loading = undefined; this.emit('loadingchange', { loading: false, mapId }); }
    }
  }
  getState(): EngineState {
    this.assertAlive();
    return { mapId: this.snapshot?.mapId, snapshotId: this.snapshot?.snapshotId, camera: this.snapshot ? this.renderer.getView() : undefined, selectedEntityId: this.selected, loading: !!this.loading, layers: [...this.layers.values()].map(s => ({ ...s })) };
  }
  getEntity(id: string): Entity | undefined { this.assertAlive(); const e = this.entities.get(id); return e ? structuredClone(e) : undefined; }
  getEntities(): Entity[] { this.assertAlive(); return [...this.entities.values()].map(e => structuredClone(e)); }
  getLayers(): (MapLayer & LayerState)[] { return this.active().layers.map(l => ({ ...structuredClone(l), ...this.layers.get(l.id)! })); }
  getMap(): Omit<MapSnapshot, 'entities'> { const { entities: _, ...map } = this.active(); return structuredClone(map); }
  private getSelected(): Entity | undefined { return this.selected ? this.getEntity(this.selected) : undefined; }
  setView(camera: Camera, cause: ViewCause = 'api'): void {
    const map = this.active(); const validated = cameraSchema.parse(camera);
    if (map.coordinateSystem.kind === 'geographic') validateGeographicPosition(validated.center);
    this.suppressView = true; try { this.renderer.setView(validated); } finally { this.suppressView = false; }
    this.emit('viewchange', { camera: this.renderer.getView(), cause, settled: true });
  }
  fitBounds(bounds?: Bounds, padding = 32, cause: ViewCause = 'api'): void {
    const map = this.active(); const b = bounds ?? map.bounds;
    if (b.some(n => !Number.isFinite(n)) || b[0] > b[2] || b[1] > b[3] || !Number.isFinite(padding) || padding < 0) throw new MapError('INVALID_BOUNDS', 'Invalid fit bounds or padding');
    if (map.coordinateSystem.kind === 'geographic') { validateGeographicPosition([b[0], b[1]]); validateGeographicPosition([b[2], b[3]]); }
    this.suppressView = true; let camera: Camera;
    try { camera = this.renderer.fitBounds(b, padding); } finally { this.suppressView = false; }
    this.emit('viewchange', { camera, cause, settled: true });
  }
  focusEntity(id: string, cause: ViewCause = 'api'): void {
    this.active(); const entity = this.entities.get(id); if (!entity) throw new MapError('NOT_FOUND', 'Entity not found');
    this.setLayerVisibility(entity.layerId, true);
    if (entity.geometry.type === 'Point') this.setView({ ...this.renderer.getView(), center: entity.geometry.coordinates }, cause);
    else this.fitBounds(entityBounds(entity), 48, cause);
  }
  mapToScreen(position: Position): Position | undefined { this.active(); return this.renderer.mapToScreen(position); }
  screenToMap(pixel: Position): Position | undefined { this.active(); return this.renderer.screenToMap(pixel); }
  pick(pixel: Position): Hit[] { this.active(); return structuredClone(this.renderer.pick(pixel)); }
  setLayerVisibility(id: string, visible: boolean): void {
    this.active(); const state = this.layers.get(id); if (!state) throw new MapError('NOT_FOUND', 'Layer not found');
    if (typeof visible !== 'boolean') throw new MapError('INVALID_LAYER', 'Visibility must be boolean');
    if (state.visible === visible) return;
    state.visible = visible; this.renderer.setLayer(state);
    if (!visible && this.selected && this.entities.get(this.selected)?.layerId === id) this.clearSelection();
    this.emit('layerchange', { ...state });
  }
  setLayerOpacity(id: string, opacity: number): void {
    this.active(); const state = this.layers.get(id); if (!state) throw new MapError('NOT_FOUND', 'Layer not found');
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new MapError('INVALID_OPACITY', 'Opacity must be in [0,1]');
    state.opacity = opacity; this.renderer.setLayer(state); this.emit('layerchange', { ...state });
  }
  selectEntity(id: string, cause: ViewCause = 'api'): void {
    this.active(); const e = this.entities.get(id); if (!e) throw new MapError('NOT_FOUND', 'Entity not found');
    this.setLayerVisibility(e.layerId, true);
    if (this.selected === id) return;
    this.selected = id; this.renderer.select(e); this.emit('selectionchange', { entity: structuredClone(e), cause });
  }
  clearSelection(cause: ViewCause = 'api'): void {
    this.assertAlive(); if (!this.selected) return;
    this.selected = undefined; this.renderer.select(); this.emit('selectionchange', { cause });
  }
  upsertEntities(input: readonly Entity[]): void {
    const validated = validateEntities(input, this.active()); this.renderer.upsert(validated);
    for (const e of validated) this.entities.set(e.id, e);
    if (this.selected) {
      const selected = this.entities.get(this.selected)!;
      if (!this.layers.get(selected.layerId)!.visible) this.clearSelection();
      else { this.renderer.select(selected); this.emit('selectionchange', { entity: structuredClone(selected), cause: 'api' }); }
    }
    this.emit('entitieschange', { upserted: validated.map(e => e.id), removed: [] });
  }
  removeEntities(ids: readonly string[]): void {
    this.active(); const existing = [...new Set(ids)].filter(id => this.entities.has(id)); this.renderer.remove(existing);
    for (const id of existing) this.entities.delete(id);
    if (this.selected && !this.entities.has(this.selected)) this.clearSelection();
    this.emit('entitieschange', { upserted: [], removed: existing });
  }
  activateContent(entityId: string, index: number): void {
    this.active(); const entity = this.entities.get(entityId), content: ContentRef | undefined = entity?.contentRefs?.[index];
    if (!entity || !content) throw new MapError('NOT_FOUND', 'Content reference not found');
    this.emit('contentactivate', { entity: structuredClone(entity), content: structuredClone(content) });
  }
  serializeViewState(): string {
    const state = this.getState(); this.active();
    return serializeViewState({ version: 1, mapId: state.mapId!, snapshotId: state.snapshotId!, camera: state.camera, selectedEntityId: state.selectedEntityId, layers: Object.fromEntries(state.layers.map(l => [l.id, l.visible])) });
  }
  parseViewState(value: string) { return parseViewState(value); }
  async applyViewState(input: ViewState | string): Promise<void> {
    const parsed = typeof input === 'string' ? parseViewState(input) : parseViewState(encodeURIComponent(JSON.stringify(input)));
    for (const message of parsed.diagnostics) this.emit('warning', { code: 'INVALID_LINK_FIELD', message });
    await this.loadMap(parsed.state.mapId, { viewState: parsed.state });
  }
  private click(hits: Hit[]): void {
    if (!this.snapshot) return; const hit = hits[0];
    if (!hit) { this.clearSelection('interaction'); return; }
    if (!hit.cluster) { this.selectEntity(hit.entityIds[0], 'interaction'); return; }
    const entities = hit.entityIds.map(id => this.entities.get(id)!).filter(Boolean);
    if (!entities.length) return;
    const bounds = entities.map(entityBounds);
    const b: Bounds = [Math.min(...bounds.map(b => b[0])), Math.min(...bounds.map(b => b[1])), Math.max(...bounds.map(b => b[2])), Math.max(...bounds.map(b => b[3]))];
    if (b[0] !== b[2] || b[1] !== b[3]) this.fitBounds(b, 48, 'interaction');
    this.emit('clusteractivate', { entities: entities.map(e => structuredClone(e)) });
  }
  destroy(): void {
    if (this.dead) return; this.dead = true; ++this.generation; this.loading?.abort(); this.loading = undefined;
    this.renderer.destroy(); this.listeners.clear(); this.entities.clear(); this.layers.clear(); this.snapshot = undefined;
  }
}
export function createMapEngine(options: EngineOptions): MapEngine { return new MapEngine(options); }
