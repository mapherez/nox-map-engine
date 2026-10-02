import { createMapEngine } from '@nox-map/engine';
import { StaticHttpDataSource } from '@nox-map/data-source-static';
import type { MapDataSource } from '@nox-map/core';
import '../../packages/engine/src/style.css';
/** The native host may inject its own provider before this module runs. */
declare global { interface Window { noxDataSource?: MapDataSource; noxBridge?: { openMap(id: string): Promise<void>; select(id: string): void; destroy(): void }; onNoXSelection?: (id?: string) => void } }
const engine = createMapEngine({ container: document.getElementById('map')!, dataSource: window.noxDataSource ?? new StaticHttpDataSource({ catalogUrl: new URL('../maps/catalog.json', document.baseURI).href }) });
engine.on('loadingchange', ({ loading }) => document.getElementById('map')!.setAttribute('aria-busy', String(loading)));
engine.on('selectionchange', ({ entity }) => { document.getElementById('selection')!.textContent = entity?.label ?? ''; window.onNoXSelection?.(entity?.id); });
window.noxBridge = { openMap: id => engine.loadMap(id), select: id => engine.selectEntity(id), destroy: () => engine.destroy() };
void engine.loadMap('local'); window.addEventListener('pagehide', () => engine.destroy(), { once: true });
