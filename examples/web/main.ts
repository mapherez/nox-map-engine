import { createMapEngine } from '@nox-map/engine';
import { StaticHttpDataSource } from '@nox-map/data-source-static';
import '../../packages/engine/src/style.css';
const engine = createMapEngine({ container: document.getElementById('map')!, dataSource: new StaticHttpDataSource({ catalogUrl: new URL('../maps/catalog.json', document.baseURI).href }) });
engine.on('loadingchange', ({ loading }) => document.getElementById('map')!.setAttribute('aria-busy', String(loading)));
engine.on('selectionchange', ({ entity }) => { document.getElementById('selection')!.textContent = entity ? JSON.stringify(entity.metadata ?? { id: entity.id }) : ''; });
void engine.loadMap('local');
window.addEventListener('pagehide', () => engine.destroy(), { once: true });
