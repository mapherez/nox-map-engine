import type { AssetRef, MapDataSource, MapSnapshot } from '@nox-map/core';
interface PendingImage { promise: Promise<HTMLImageElement>; controller: AbortController; consumers: number; settled: boolean }
/** In-flight deduplication only. Decoded tile retention belongs to OpenLayers. */
export class AssetLoader {
  private controller = new AbortController();
  private pending = new Map<string, PendingImage>();
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private source: MapDataSource, private snapshot: MapSnapshot, private limit: number) {}
  private async slot(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.active < this.limit) { this.active++; return; }
    await new Promise<void>((resolve, reject) => {
      const abort = () => { const index = this.waiting.indexOf(wake); if (index !== -1) this.waiting.splice(index, 1); reject(signal.reason); };
      const wake = () => { signal.removeEventListener('abort', abort); this.active++; resolve(); };
      this.waiting.push(wake); signal.addEventListener('abort', abort, { once: true });
    });
  }
  image(ref: AssetRef, tileSignal?: AbortSignal): Promise<HTMLImageElement> {
    if (tileSignal?.aborted) return Promise.reject(tileSignal.reason);
    if (this.controller.signal.aborted) return Promise.reject(this.controller.signal.reason);
    const key = `${this.snapshot.mapId}/${this.snapshot.snapshotId}/${ref.uri}`;
    let entry = this.pending.get(key);
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController();
      const created: PendingImage = { promise: undefined as never, controller, consumers: 0, settled: false };
      created.promise = this.load(ref, AbortSignal.any([this.controller.signal, controller.signal])).finally(() => {
        created.settled = true; if (this.pending.get(key) === created) this.pending.delete(key);
      });
      this.pending.set(key, created); entry = created;
    }
    const shared = entry; shared.consumers++;
    return new Promise((resolve, reject) => {
      let done = false;
      const release = () => {
        if (done) return false; done = true; tileSignal?.removeEventListener('abort', abort);
        if (--shared.consumers === 0 && !shared.settled) shared.controller.abort(); return true;
      };
      const abort = () => { if (release()) reject(tileSignal!.reason); };
      tileSignal?.addEventListener('abort', abort, { once: true });
      shared.promise.then(image => { if (release()) resolve(image); }, error => { if (release()) reject(error); });
    });
  }
  private async load(ref: AssetRef, signal: AbortSignal): Promise<HTMLImageElement> {
    await this.slot(signal);
    try {
      signal.throwIfAborted();
      const blob = await this.source.fetchAsset(ref, { mapId: this.snapshot.mapId, snapshotId: this.snapshot.snapshotId, signal });
      signal.throwIfAborted();
      const url = URL.createObjectURL(blob), image = new Image();
      try { image.src = url; await image.decode(); signal.throwIfAborted(); return image; }
      finally { URL.revokeObjectURL(url); }
    } finally { this.active--; this.waiting.shift()?.(); }
  }
  destroy(): void { this.controller.abort(); this.pending.clear(); }
}
