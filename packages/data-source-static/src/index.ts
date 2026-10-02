import { MapError, validateSnapshot, type AssetRef, type MapDataSource, type MapSnapshot, type MapSummary } from '@nox-map/core';
export interface CatalogEntry extends MapSummary { currentSnapshotId: string; snapshots: Record<string, string> }
export interface StaticCatalog { maps: CatalogEntry[] }
export interface StaticHttpOptions {
  catalogUrl: string;
  /** Supply authentication here; never put credentials in map state. */
  request?: (url: string, signal: AbortSignal) => Promise<Response>;
}
function absolute(uri: string, base: string): string {
  return new URL(uri, base).href.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
}
export class StaticHttpDataSource implements MapDataSource {
  private catalogUrl: string;
  private request: NonNullable<StaticHttpOptions['request']>;
  constructor(options: StaticHttpOptions) {
    this.catalogUrl = absolute(options.catalogUrl, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI);
    this.request = options.request ?? ((url, signal) => fetch(url, { signal }));
  }
  private async response(url: string, signal: AbortSignal): Promise<Response> {
    signal.throwIfAborted();
    const response = await this.request(url, signal); signal.throwIfAborted();
    if (!response.ok) throw new MapError(response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : response.status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR', `${response.status} while loading resource`);
    return response;
  }
  private async catalog(signal: AbortSignal): Promise<StaticCatalog> {
    const raw: unknown = await (await this.response(this.catalogUrl, signal)).json(); signal.throwIfAborted();
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as StaticCatalog).maps)) throw new MapError('INVALID_CATALOG', 'Catalog must contain maps[]');
    const ids = new Set<string>();
    for (const entry of (raw as StaticCatalog).maps) {
      if (!entry || typeof entry.mapId !== 'string' || !entry.mapId || ids.has(entry.mapId) || typeof entry.title !== 'string' || typeof entry.currentSnapshotId !== 'string' || !entry.snapshots || typeof entry.snapshots !== 'object' || !Object.hasOwn(entry.snapshots, entry.currentSnapshotId)) throw new MapError('INVALID_CATALOG', 'Invalid map identity or current snapshot');
      if (Object.values(entry.snapshots).some(v => typeof v !== 'string' || !v)) throw new MapError('INVALID_CATALOG', 'Snapshot locations must be strings');
      ids.add(entry.mapId);
    }
    return raw as StaticCatalog;
  }
  async listMaps({ signal }: { signal: AbortSignal }): Promise<MapSummary[]> {
    return (await this.catalog(signal)).maps.map(({ mapId, title, thumbnail }) => ({ mapId, title, ...(thumbnail ? { thumbnail: { uri: absolute(thumbnail.uri, this.catalogUrl) } } : {}) }));
  }
  async getSnapshot(request: { mapId: string; snapshotId?: string }, { signal }: { signal: AbortSignal }): Promise<MapSnapshot> {
    const entry = (await this.catalog(signal)).maps.find(m => m.mapId === request.mapId);
    if (!entry) throw new MapError('NOT_FOUND', 'Map not found');
    const snapshotId = request.snapshotId ?? entry.currentSnapshotId;
    if (!Object.hasOwn(entry.snapshots, snapshotId)) throw new MapError('NOT_FOUND', 'Snapshot not found');
    const url = absolute(entry.snapshots[snapshotId], this.catalogUrl);
    const raw = await (await this.response(url, signal)).json() as Record<string, unknown>;
    if (typeof raw.entitiesUrl === 'string') raw.entities = await (await this.response(absolute(raw.entitiesUrl, url), signal)).json();
    signal.throwIfAborted();
    const snapshot = validateSnapshot(raw);
    if (snapshot.mapId !== request.mapId || snapshot.snapshotId !== snapshotId) throw new MapError('IDENTITY_MISMATCH', 'Manifest identity does not match catalog');
    const resolveStyle = (style: import('@nox-map/core').EntityStyle | undefined) => {
      if (!style) return;
      for (const paint of [style, style.hover, style.selected]) if (paint?.icon) paint.icon.uri = absolute(paint.icon.uri, url);
    };
    for (const source of snapshot.sources) {
      if (source.type === 'image') source.asset.uri = absolute(source.asset.uri, url);
      else source.template = absolute(source.template, url);
    }
    for (const style of Object.values(snapshot.styles ?? {})) resolveStyle(style);
    for (const layer of snapshot.layers) resolveStyle(layer.style);
    for (const entity of snapshot.entities) resolveStyle(entity.style);
    return snapshot;
  }
  async fetchAsset(ref: AssetRef, { signal }: { mapId: string; snapshotId: string; signal: AbortSignal }): Promise<Blob> {
    const blob = await (await this.response(absolute(ref.uri, this.catalogUrl), signal)).blob(); signal.throwIfAborted(); return blob;
  }
}
export class MemoryDataSource implements MapDataSource {
  private snapshots: Map<string, Map<string, MapSnapshot>> = new Map();
  private current: Map<string, string> = new Map();
  constructor(snapshots: readonly MapSnapshot[], private assets: ReadonlyMap<string, Blob> = new Map()) {
    for (const value of snapshots) {
      const snapshot = validateSnapshot(value);
      let versions = this.snapshots.get(snapshot.mapId);
      if (!versions) { versions = new Map(); this.snapshots.set(snapshot.mapId, versions); }
      if (versions.has(snapshot.snapshotId)) throw new MapError('DUPLICATE_ID', 'Duplicate map snapshot');
      versions.set(snapshot.snapshotId, snapshot); this.current.set(snapshot.mapId, snapshot.snapshotId);
    }
  }
  async listMaps({ signal }: { signal: AbortSignal }): Promise<MapSummary[]> {
    signal.throwIfAborted(); return [...this.current].map(([mapId, id]) => ({ mapId, title: this.snapshots.get(mapId)!.get(id)!.title }));
  }
  async getSnapshot(request: { mapId: string; snapshotId?: string }, { signal }: { signal: AbortSignal }): Promise<MapSnapshot> {
    signal.throwIfAborted(); const snapshot = this.snapshots.get(request.mapId)?.get(request.snapshotId ?? this.current.get(request.mapId)!);
    if (!snapshot) throw new MapError('NOT_FOUND', 'Map or snapshot not found');
    return structuredClone(snapshot);
  }
  async fetchAsset(ref: AssetRef, { signal }: { mapId: string; snapshotId: string; signal: AbortSignal }): Promise<Blob> {
    signal.throwIfAborted(); const asset = this.assets.get(ref.uri);
    if (!asset) throw new MapError('NOT_FOUND', 'Asset not found'); return asset;
  }
}
