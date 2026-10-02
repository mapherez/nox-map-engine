import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import Feature, { type FeatureLike } from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import type OlGeometry from 'ol/geom/Geometry.js';
import Projection from 'ol/proj/Projection.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import TileLayer from 'ol/layer/Tile.js';
import ImageLayer from 'ol/layer/Image.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorImageLayer from 'ol/layer/VectorImage.js';
import type BaseLayer from 'ol/layer/Base.js';
import type { Extent } from 'ol/extent.js';
import VectorSource from 'ol/source/Vector.js';
import Cluster from 'ol/source/Cluster.js';
import ImageTileSource from 'ol/source/ImageTile.js';
import ImageSource from 'ol/source/Image.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';
import Icon from 'ol/style/Icon.js';
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js';
import DragPan from 'ol/interaction/DragPan.js';
import KeyboardPan from 'ol/interaction/KeyboardPan.js';
import KeyboardZoom from 'ol/interaction/KeyboardZoom.js';
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import { project, unproject, projectBounds, zoomResolution, resolutionZoom, type Bounds, type Camera, type Entity, type EntityStyle, type Hit, type LayerState, type MapDataSource, type MapLayer, type MapSnapshot, type Paint, type Position, type RasterSource, type RendererCallbacks, type RendererPort } from '@nox-map/core';
import { AssetLoader } from './assets.js';
export type StyleResolver = (entity: Readonly<Entity>, context: { zoom: number; state: 'normal' | 'hover' | 'selected' }) => EntityStyle | undefined;
export interface RendererOptions { gestures?: 'exclusive' | 'cooperative'; profile?: 'desktop' | 'mobile'; maxPixelRatio?: number; style?: StyleResolver }
interface VectorRecord { points: VectorSource<Feature<OlGeometry>>; polygons: VectorSource<Feature<OlGeometry>>; cluster?: Cluster; layers: BaseLayer[] }
interface Prepared {
  snapshot: MapSnapshot; assets: AssetLoader; view: View; layers: Map<string, BaseLayer[]>;
  vectors: Map<string, VectorRecord>; features: Map<string, Feature<OlGeometry>>;
  entities: Map<string, Entity>; styles: Map<string, Style>; icons: Map<string, HTMLImageElement | null>;
  subscriptions: (() => void)[];
}
const normalPaint: Paint = { fill: '#68e0bc', stroke: '#173b37', strokeWidth: 2, radius: 7, textColor: '#e8f3ef', font: '500 12px system-ui' };
/** Keep cluster membership stable during a gesture; refresh exactly at rest. */
class GestureCluster extends Cluster {
  private settledResolution?: number;
  constructor(source: VectorSource<Feature<OlGeometry>>, distance: number, private view: View) { super({ source, distance, geometryFunction: feature => feature.getGeometry() as Point }); }
  override loadFeatures(extent: Extent, resolution: number, projection: Projection): void {
    if (!this.settledResolution || (!this.view.getInteracting() && !this.view.getAnimating())) this.settledResolution = resolution;
    super.loadFeatures(extent, this.settledResolution, projection);
  }
}
export class OpenLayersRenderer implements RendererPort {
  private map!: OlMap;
  private container!: HTMLElement;
  private callbacks!: RendererCallbacks;
  private prepared?: Prepared;
  private selection = new VectorSource<Feature<OlGeometry>>();
  private hoverSource = new VectorSource<Feature<OlGeometry>>();
  private selectionLayer = new VectorLayer({ source: this.selection, zIndex: 1_000_000 });
  private hoverLayer = new VectorLayer({ source: this.hoverSource, zIndex: 999_999 });
  private observer?: ResizeObserver;
  private hoverFrame = 0;
  private latestPixel?: Position;
  private cleanup: (() => void)[] = [];
  private mobile = false;
  private changing = false;
  private programmaticMove = false;
  private dead = false;
  private previousAttributes!: { className: string; tabIndex: string | null; role: string | null; label: string | null; touchAction: string };
  constructor(private options: RendererOptions = {}) {}
  mount(container: HTMLElement, callbacks: RendererCallbacks): void {
    this.container = container; this.callbacks = callbacks;
    this.mobile = this.options.profile === 'mobile' || (!this.options.profile && matchMedia('(pointer: coarse)').matches);
    this.previousAttributes = { className: container.className, tabIndex: container.getAttribute('tabindex'), role: container.getAttribute('role'), label: container.getAttribute('aria-label'), touchAction: container.style.touchAction };
    container.classList.add('nox-map'); container.tabIndex = 0; container.setAttribute('role', 'region'); container.setAttribute('aria-label', 'Interactive map');
    const cooperative = (this.options.gestures ?? 'cooperative') === 'cooperative';
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const interactions = defaultInteractions({ altShiftDragRotate: false, pinchRotate: false, onFocusOnly: cooperative, dragPan: !reducedMotion, keyboard: !reducedMotion, zoomDuration: reducedMotion ? 0 : 250 });
    if (reducedMotion) { interactions.push(new DragPan({ onFocusOnly: cooperative })); interactions.push(new KeyboardPan({ duration: 0 })); interactions.push(new KeyboardZoom({ duration: 0 })); }
    container.style.touchAction = cooperative ? 'pan-y' : 'none';
    this.map = new OlMap({
      target: container, layers: [this.hoverLayer, this.selectionLayer], controls: [],
      pixelRatio: Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio ?? 2),
      maxTilesLoading: this.mobile ? 4 : 8,
      interactions,
      view: new View({ center: [0, 0], zoom: 0, enableRotation: false })
    });
    // Cooperative mode preserves page wheel scrolling until explicitly requested.
    if (cooperative) {
      const wheel = (event: WheelEvent) => { if (!event.ctrlKey && !event.metaKey) event.stopPropagation(); };
      container.addEventListener('wheel', wheel, { capture: true, passive: true });
      this.cleanup.push(() => container.removeEventListener('wheel', wheel, true));
    }
    const key = (event: KeyboardEvent) => {
      const target = event.composedPath()[0];
      if (target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]')) { event.stopPropagation(); return; }
      if (event.key === 'Escape') callbacks.clear();
    };
    container.addEventListener('keydown', key); this.cleanup.push(() => container.removeEventListener('keydown', key));
    this.map.on('singleclick', event => callbacks.click(this.pick(event.pixel as Position)));
    this.map.on('pointermove', event => {
      if (event.dragging || (event.originalEvent instanceof PointerEvent && event.originalEvent.pointerType === 'touch')) return;
      this.latestPixel = event.pixel as Position;
      if (!this.hoverFrame) this.hoverFrame = requestAnimationFrame(() => {
        this.hoverFrame = 0; if (this.latestPixel && !this.dead) callbacks.hover(this.pick(this.latestPixel), this.latestPixel);
      });
    });
    const leave = () => { this.latestPixel = undefined; callbacks.hover([], [0, 0]); };
    container.addEventListener('pointerleave', leave); this.cleanup.push(() => container.removeEventListener('pointerleave', leave));
    this.map.on('movestart', () => { this.hoverSource.clear(); callbacks.hover([], [0, 0]); });
    this.map.on('moveend', () => {
      if (this.prepared) for (const record of this.prepared.vectors.values()) if (record.cluster) record.layers.at(-1)!.changed();
      if (this.prepared && !this.changing && !this.programmaticMove) callbacks.view(this.getView(), true);
      this.programmaticMove = false;
    });
    this.observer = new ResizeObserver(() => this.map.updateSize()); this.observer.observe(container);
  }
  private geometry(entity: Entity, snapshot: MapSnapshot): OlGeometry {
    const g = entity.geometry, transform = (p: Position) => project(p, snapshot.coordinateSystem);
    if (g.type === 'Point') return new Point(transform(g.coordinates));
    if (g.type === 'Polygon') return new Polygon(g.coordinates.map(r => r.map(transform)));
    return new MultiPolygon(g.coordinates.map(poly => poly.map(r => r.map(transform))));
  }
  private feature(entity: Entity, snapshot: MapSnapshot): Feature<OlGeometry> {
    const f = new Feature({ geometry: this.geometry(entity, snapshot), entityId: entity.id }); f.setId(entity.id); return f;
  }
  private raster(source: RasterSource, p: Prepared, budgetPixels: number): BaseLayer {
    const snapshot = p.snapshot;
    if (source.type === 'image') {
      const [x, y] = source.origin, w = source.width * source.unitsPerPixel, h = source.height * source.unitsPerPixel;
      const extent: Bounds = [x, -(y + h), x + w, -y];
      return new ImageLayer({ extent, source: new ImageSource({ projection: p.view.getProjection(), loader: async () => {
        try { const image = await p.assets.image(source.asset); return { image, extent, resolution: source.unitsPerPixel, pixelRatio: 1 }; }
        catch (error) { if (!this.dead && this.prepared === p && (error as Error).name !== 'AbortError') this.callbacks.error(error as Error); throw error; }
      } }) });
    }
    const size = source.tileSize;
    let grid: TileGrid | undefined;
    let extent: Bounds | undefined;
    if (source.type === 'raster-pyramid') {
      const [x, y] = source.origin;
      extent = [x, -(y + source.height * source.unitsPerPixel), x + source.width * source.unitsPerPixel, -y];
      grid = new TileGrid({ extent, origin: [x, -y], tileSize: size, resolutions: Array.from({ length: source.maxLevel + 1 }, (_, z) => source.unitsPerPixel * 2 ** (source.maxLevel - z)) });
    }
    const tiles = new ImageTileSource({
      projection: p.view.getProjection(), tileGrid: grid, wrapX: false, tileSize: size,
      minZoom: source.type === 'xyz' ? source.minLevel : 0, maxZoom: source.maxLevel,
      maxResolution: source.type === 'xyz' ? 2 * Math.PI * 6378137 / size : undefined,
      transition: 120,
      loader: async (z, x, y, options) => {
        const uri = source.template.replaceAll('{z}', String(z)).replaceAll('{x}', String(x)).replaceAll('{y}', String(y));
        try { return await p.assets.image({ uri }, options.signal); }
        catch (error) { if (!this.dead && this.prepared === p && (error as Error).name !== 'AbortError') this.callbacks.error(error as Error); throw error; }
      }
    });
    return new TileLayer({ source: tiles, extent, cacheSize: Math.max(16, Math.floor(budgetPixels / (size * size))) });
  }
  prepare(snapshot: MapSnapshot, source: MapDataSource): void {
    const cs = snapshot.coordinateSystem;
    const extent = projectBounds(snapshot.bounds, cs);
    const view = new View({
      projection: cs.kind === 'local' ? new Projection({ code: `NOX:${snapshot.mapId}:${snapshot.snapshotId}`, units: 'pixels', extent }) : 'EPSG:3857',
      center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2], resolution: zoomResolution(0, cs),
      maxResolution: zoomResolution(snapshot.minZoom ?? (cs.kind === 'local' ? -30 : 0), cs),
      minResolution: zoomResolution(snapshot.maxZoom ?? (cs.kind === 'local' ? 20 : 22), cs),
      extent, constrainOnlyCenter: true, smoothExtentConstraint: false, enableRotation: false, constrainResolution: false
    });
    const p: Prepared = { snapshot, view, assets: new AssetLoader(source, snapshot, this.mobile ? 4 : 8), layers: new Map(), vectors: new Map(), features: new Map(), entities: new Map(snapshot.entities.map(e => [e.id, e])), styles: new Map(), icons: new Map(), subscriptions: [] };
    const all: BaseLayer[] = [];
    try {
      const rasterCount = Math.max(1, snapshot.layers.filter(l => l.type === 'raster').length);
      const budget = (this.mobile ? 64 : 128) * 256 ** 2 / rasterCount;
      const grouped = new Map<string, Feature<OlGeometry>[]>();
      for (const entity of snapshot.entities) {
        const feature = this.feature(entity, snapshot); p.features.set(entity.id, feature);
        const list = grouped.get(entity.layerId) ?? []; list.push(feature); grouped.set(entity.layerId, list);
      }
      snapshot.layers.forEach((layer, index) => {
        const layers: BaseLayer[] = [];
        if (layer.type === 'raster') layers.push(this.raster(snapshot.sources.find(s => s.id === layer.sourceId)!, p, budget));
        else {
          const features = grouped.get(layer.id) ?? [];
          const points = new VectorSource({ features: features.filter(f => f.getGeometry() instanceof Point), wrapX: false });
          const polygons = new VectorSource({ features: features.filter(f => !(f.getGeometry() instanceof Point)), wrapX: false });
          const cluster = layer.cluster ? new GestureCluster(points, layer.cluster.distance, view) : undefined;
          const style = (feature: FeatureLike, resolution: number) => this.style(feature as Feature<OlGeometry>, layer, p, resolution, 'normal');
          const polyLayer = new VectorImageLayer({ source: polygons, style, imageRatio: 1.25, renderBuffer: 64, declutter: 'nox-labels' });
          const pointLayer = new VectorLayer({ source: cluster ?? points, style, declutter: 'nox-labels', renderBuffer: 64 });
          polyLayer.set('noxPick', true); pointLayer.set('noxPick', true);
          layers.push(polyLayer, pointLayer); p.vectors.set(layer.id, { points, polygons, cluster, layers });
        }
        for (const l of layers) {
          l.setVisible(layer.visible); l.setOpacity(layer.opacity); l.setZIndex(layer.order * 10 + index / Math.max(1, snapshot.layers.length)); l.set('logicalId', layer.id);
          if (layer.minZoom !== undefined) l.setMaxResolution(zoomResolution(layer.minZoom, cs));
          if (layer.maxZoom !== undefined) l.setMinResolution(zoomResolution(layer.maxZoom, cs));
          all.push(l);
        }
        p.layers.set(layer.id, layers);
      });
      const change = () => { if (!this.changing && this.prepared === p) { this.programmaticMove = false; this.callbacks.view(this.getView(), false); } };
      view.on('change:center', change); view.on('change:resolution', change);
      p.subscriptions.push(() => { view.un('change:center', change); view.un('change:resolution', change); });
    } catch (error) { this.dispose(p); throw error; }
    const previous = this.prepared;
    this.changing = true;
    this.map.setLayers([...all, this.hoverLayer, this.selectionLayer]); this.map.setView(view); this.prepared = p;
    this.selection.clear(); this.hoverSource.clear(); this.changing = false;
    if (previous) this.dispose(previous);
  }
  private style(feature: Feature<OlGeometry>, layer: MapLayer, p: Prepared, resolution: number, state: 'normal' | 'hover' | 'selected'): Style {
    const cluster = feature.get('features') as Feature<OlGeometry>[] | undefined;
    if (cluster && cluster.length > 1) {
      const key = `cluster:${cluster.length}`; const cached = p.styles.get(key); if (cached) return cached;
      const value = new Style({ image: new CircleStyle({ radius: 16, fill: new Fill({ color: '#244e46' }), stroke: new Stroke({ color: '#86ecd0', width: 2 }) }), text: new Text({ text: String(cluster.length), fill: new Fill({ color: '#ffffff' }), font: '600 12px system-ui' }) });
      p.styles.set(key, value); return value;
    }
    const entity = p.entities.get((cluster?.[0] ?? feature).get('entityId'));
    if (!entity) return new Style();
    const zoom = resolutionZoom(resolution, p.snapshot.coordinateSystem);
    const supplied = this.options.style?.(entity, { zoom, state });
    const merged: EntityStyle = { ...normalPaint, ...layer.style, ...p.snapshot.styles?.[entity.styleId ?? ''], ...entity.style, ...supplied };
    const paint: Paint = { ...merged, ...(state === 'normal' ? {} : state === 'selected' ? { stroke: '#ffcf70', strokeWidth: 3, radius: 10, ...merged.selected } : { stroke: '#ffffff', strokeWidth: 3, ...merged.hover }) };
    const label = state !== 'normal' || (zoom >= (paint.labelMinZoom ?? -Infinity) && zoom <= (paint.labelMaxZoom ?? Infinity)) ? entity.label : undefined;
    const key = `${JSON.stringify(paint)}|${label ?? ''}`; const existing = p.styles.get(key); if (existing) return existing;
    let image: Icon | CircleStyle = new CircleStyle({ radius: paint.radius ?? 7, fill: new Fill({ color: paint.fill }), stroke: new Stroke({ color: paint.stroke, width: paint.strokeWidth }) });
    if (paint.icon) {
      const uri = paint.icon.uri; const icon = p.icons.get(uri);
      if (icon) image = new Icon({ img: icon, width: paint.size?.[0] ?? 24, height: paint.size?.[1] ?? 24, anchor: paint.anchor ?? [0.5, 1] });
      else if (!p.icons.has(uri)) {
        p.icons.set(uri, null);
        void p.assets.image(paint.icon).then(img => {
          if (this.prepared !== p || this.dead) return;
          p.icons.set(uri, img); p.styles.clear(); for (const layers of p.layers.values()) for (const l of layers) l.changed(); this.selectionLayer.changed(); this.hoverLayer.changed();
        }).catch(error => { if (this.prepared === p && !this.dead && error.name !== 'AbortError') this.callbacks.error(error); });
      }
    }
    const value = new Style({
      image, fill: new Fill({ color: paint.fill === normalPaint.fill && entity.geometry.type !== 'Point' ? '#68e0bc33' : paint.fill }),
      stroke: new Stroke({ color: paint.stroke, width: paint.strokeWidth }),
      text: label ? new Text({ text: label, font: paint.font, offsetY: entity.geometry.type === 'Point' ? -20 : 0, fill: new Fill({ color: paint.textColor }), stroke: new Stroke({ color: '#11211c', width: 3 }) }) : undefined,
      zIndex: state === 'normal' ? paint.priority ?? 0 : 1_000_000
    });
    // Bound style retention for callbacks depending on fractional zoom.
    if (p.styles.size > 12000) p.styles.clear(); p.styles.set(key, value); return value;
  }
  getView(): Camera {
    const p = this.prepared!; const view = this.map.getView();
    return { center: unproject(view.getCenter() as Position, p.snapshot.coordinateSystem), zoom: resolutionZoom(view.getResolution()!, p.snapshot.coordinateSystem) };
  }
  setView(camera: Camera): void {
    const p = this.prepared!; this.changing = true; this.programmaticMove = true;
    try { p.view.cancelAnimations(); p.view.setCenter(project(camera.center, p.snapshot.coordinateSystem)); p.view.setResolution(zoomResolution(camera.zoom, p.snapshot.coordinateSystem)); p.view.resolveConstraints(0); }
    finally { this.changing = false; }
  }
  fitBounds(bounds: Bounds, padding = 32): Camera {
    this.changing = true; this.programmaticMove = true;
    try {
      const size = this.map.getSize() ?? [800, 600]; const safePadding = Math.min(padding, Math.max(0, Math.min(...size) / 2 - 1));
      this.map.getView().fit(projectBounds(bounds, this.prepared!.snapshot.coordinateSystem), { size, padding: [safePadding, safePadding, safePadding, safePadding], duration: 0 });
      this.map.renderSync(); return this.getView();
    } finally { this.changing = false; }
  }
  mapToScreen(position: Position): Position | undefined { this.map.renderSync(); return this.map.getPixelFromCoordinate(project(position, this.prepared!.snapshot.coordinateSystem)) as Position | undefined; }
  screenToMap(pixel: Position): Position | undefined { this.map.renderSync(); const p = this.map.getCoordinateFromPixel(pixel); return p ? unproject(p as Position, this.prepared!.snapshot.coordinateSystem) : undefined; }
  pick(pixel: Position): Hit[] {
    if (!this.prepared) return [];
    const hits: Hit[] = [], seen = new Set<string>();
    this.map.forEachFeatureAtPixel(pixel, (f) => {
      const members = f.get('features') as Feature<OlGeometry>[] | undefined;
      const ids = (members ?? [f]).map(m => m.get('entityId') as string).filter(id => id && !seen.has(id));
      for (const id of ids) seen.add(id); if (ids.length) hits.push({ entityIds: ids, cluster: ids.length > 1 });
      return undefined;
    }, { hitTolerance: this.mobile ? 8 : 4, checkWrapped: false, layerFilter: l => l.get('noxPick') === true && l.getVisible() && l.getOpacity() > 0 });
    return hits;
  }
  setLayer(state: LayerState): void {
    for (const layer of this.prepared?.layers.get(state.id) ?? []) { layer.setVisible(state.visible); layer.setOpacity(state.opacity); }
    const hovered = this.hoverSource.getFeatures()[0]?.get('entityId');
    if ((!state.visible || state.opacity === 0) && this.prepared?.entities.get(hovered)?.layerId === state.id) this.callbacks.hover([], [0, 0]);
  }
  private highlight(entity: Entity | undefined, source: VectorSource<Feature<OlGeometry>>, state: 'hover' | 'selected'): void {
    source.clear(); if (!entity || !this.prepared) return; const p = this.prepared;
    const f = this.feature(entity, p.snapshot); f.setStyle((_feature, resolution) => this.style(f, p.snapshot.layers.find(l => l.id === entity.layerId)!, p, resolution, state)); source.addFeature(f);
  }
  select(entity?: Entity): void { this.highlight(entity, this.selection, 'selected'); }
  hover(entity?: Entity): void {
    if (this.hoverSource.getFeatures()[0]?.get('entityId') === entity?.id) return;
    this.highlight(entity, this.hoverSource, 'hover'); this.container.style.cursor = entity ? 'pointer' : '';
  }
  upsert(entities: readonly Entity[]): void {
    const p = this.prepared!;
    this.remove(entities.map(e => e.id));
    const grouped = new Map<VectorSource<Feature<OlGeometry>>, Feature<OlGeometry>[]>();
    for (const entity of entities) {
      const f = this.feature(entity, p.snapshot), record = p.vectors.get(entity.layerId)!;
      p.entities.set(entity.id, entity); p.features.set(entity.id, f);
      const source = entity.geometry.type === 'Point' ? record.points : record.polygons;
      const list = grouped.get(source) ?? []; list.push(f); grouped.set(source, list);
    }
    for (const [source, features] of grouped) source.addFeatures(features); p.styles.clear();
  }
  remove(ids: readonly string[]): void {
    const p = this.prepared!; const grouped = new Map<VectorSource<Feature<OlGeometry>>, Feature<OlGeometry>[]>();
    for (const id of ids) {
      const entity = p.entities.get(id), feature = p.features.get(id); if (!entity || !feature) continue;
      const record = p.vectors.get(entity.layerId)!;
      const source = entity.geometry.type === 'Point' ? record.points : record.polygons;
      const list = grouped.get(source) ?? []; list.push(feature); grouped.set(source, list);
      p.entities.delete(id); p.features.delete(id);
    }
    for (const [source, features] of grouped) source.removeFeatures(features);
    if (ids.includes(this.hoverSource.getFeatures()[0]?.get('entityId'))) this.callbacks.hover([], [0, 0]);
  }
  private dispose(p: Prepared): void {
    p.assets.destroy(); for (const unsubscribe of p.subscriptions) unsubscribe();
    for (const record of p.vectors.values()) { record.cluster?.setSource(null); record.points.clear(true); record.polygons.clear(true); }
    for (const layers of p.layers.values()) for (const layer of layers) { layer.dispose(); }
    p.layers.clear(); p.features.clear(); p.entities.clear(); p.styles.clear(); p.icons.clear();
  }
  destroy(): void {
    if (this.dead) return; this.dead = true;
    cancelAnimationFrame(this.hoverFrame); this.observer?.disconnect(); for (const fn of this.cleanup) fn();
    if (this.prepared) this.dispose(this.prepared); this.prepared = undefined;
    this.selection.clear(true); this.hoverSource.clear(true); this.map.setTarget(undefined); this.map.dispose();
    this.selectionLayer.dispose(); this.hoverLayer.dispose();
    const before = this.previousAttributes;
    this.container.className = before.className; this.container.style.touchAction = before.touchAction; this.container.style.cursor = '';
    for (const [key, value] of [['tabindex', before.tabIndex], ['role', before.role], ['aria-label', before.label]] as const) if (value === null) this.container.removeAttribute(key); else this.container.setAttribute(key, value);
  }
}
