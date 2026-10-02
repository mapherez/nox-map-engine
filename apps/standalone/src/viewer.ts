import { createMapEngine, type MapEngine } from '@nox-map/engine';
import { mountControls } from '@nox-map/controls';
import type { Entity, MapDataSource } from '@nox-map/core';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export interface ViewerOptions { dataSource: MapDataSource; gestures?: 'exclusive' | 'cooperative' }
export async function startViewer(options: ViewerOptions): Promise<() => void> {
  const lifetime = new AbortController(); const signal = lifetime.signal;
  const source = options.dataSource;
  const engine = createMapEngine({ container: $('map'), dataSource: source, gestures: options.gestures ?? 'exclusive' });
  const cleanupControls = mountControls(engine, { container: $('map'), detailsContainer: $('details') });
  const subscriptions: (() => void)[] = [];
  let entityListeners = new AbortController(), layerListeners = new AbortController(), clusterListeners = new AbortController();
  let page = 0, entities: Entity[] = [], timer: ReturnType<typeof setTimeout> | undefined, restoring = false, loadingUI = false;
  const pageSize = 25;
  const message = (text: string) => {
    clearTimeout(timer); $('message').textContent = text; $('message').hidden = false;
    timer = setTimeout(() => { $('message').hidden = true; }, 5500);
  };
  const save = (push: boolean) => {
    if (restoring || loadingUI || !engine.getState().mapId) return;
    const hash = engine.serializeViewState(); if (hash === location.hash) return;
    history[push ? 'pushState' : 'replaceState'](null, '', hash);
  };
  const renderEntities = () => {
    entityListeners.abort(); entityListeners = new AbortController();
    const search = $<HTMLInputElement>('search').value.toLocaleLowerCase();
    const visible = new Set(engine.getState().layers.filter(l => l.visible).map(l => l.id));
    const filtered = entities.filter(e => visible.has(e.layerId) && `${e.label ?? ''} ${e.id} ${e.description ?? ''}`.toLocaleLowerCase().includes(search));
    page = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
    $('entity-count').textContent = String(filtered.length); const list = $('entities'); list.replaceChildren();
    for (const entity of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
      const li = document.createElement('li'), button = document.createElement('button'); button.type = 'button';
      button.setAttribute('aria-current', String(entity.id === engine.getState().selectedEntityId));
      const glyph = document.createElement('span'); glyph.className = 'entity-glyph'; glyph.textContent = entity.geometry.type === 'Point' ? '◉' : '◇'; glyph.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.textContent = entity.label ?? entity.id;
      const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.className = 'entity-arrow'; arrow.setAttribute('aria-hidden', 'true');
      button.append(glyph, name, arrow); button.addEventListener('click', () => { engine.focusEntity(entity.id); engine.selectEntity(entity.id); }, { signal: entityListeners.signal }); li.append(button); list.append(li);
    }
    if (!filtered.length) { const li = document.createElement('li'); li.textContent = 'Nenhuma entidade encontrada.'; list.append(li); }
    $('page-count').textContent = `${filtered.length ? page + 1 : 0} / ${Math.ceil(filtered.length / pageSize)}`;
    $<HTMLButtonElement>('previous').disabled = page === 0; $<HTMLButtonElement>('next').disabled = (page + 1) * pageSize >= filtered.length;
  };
  const renderLayers = () => {
    layerListeners.abort(); layerListeners = new AbortController();
    const layers = engine.getLayers(); $('layer-count').textContent = String(layers.length); $('layers').replaceChildren();
    for (const layer of layers) {
      const row = document.createElement('div'); row.className = 'layer-row';
      const input = document.createElement('input'); input.type = 'checkbox'; input.id = `layer-${encodeURIComponent(layer.id)}`; input.checked = layer.visible;
      const label = document.createElement('label'); label.htmlFor = input.id; label.textContent = layer.title;
      const symbol = document.createElement('span'); symbol.className = 'layer-symbol'; symbol.style.background = layer.style?.fill ?? (layer.type === 'raster' ? '#9cafa0' : '#9ae5c3'); symbol.setAttribute('aria-hidden', 'true');
      input.addEventListener('change', () => engine.setLayerVisibility(layer.id, input.checked), { signal: layerListeners.signal }); row.append(input, label, symbol); $('layers').append(row);
    }
  };
  subscriptions.push(engine.on('loadingchange', ({ loading }) => { loadingUI = loading; $('map').setAttribute('aria-busy', String(loading)); $<HTMLSelectElement>('map-select').disabled = loading; }));
  subscriptions.push(engine.on('mapchange', ({ mapId }) => {
    const map = engine.getMap(); $('map-title').textContent = map.title; document.title = `${map.title} — NoX Atlas`;
    $('map-subtitle').textContent = map.coordinateSystem.kind === 'local' ? 'Coordenadas locais · mapa 2D' : 'Coordenadas geográficas · mapa 2D';
    $('attribution').textContent = [...new Set(map.sources.map(s => s.attribution).filter(Boolean))].join(' · ');
    $<HTMLSelectElement>('map-select').value = mapId; entities = engine.getEntities(); page = 0; renderLayers(); renderEntities();
  }));
  subscriptions.push(engine.on('viewchange', ({ camera, settled }) => {
    if (!settled) return;
    $('coordinates').textContent = `${camera.center.map(n => n.toFixed(2)).join(' / ')}  ·  ${camera.zoom.toFixed(2)}×`;
    save(false);
  }));
  subscriptions.push(engine.on('selectionchange', ({ entity, cause }) => { clusterListeners.abort(); $('details-panel').hidden = !entity; renderEntities(); if (cause !== 'restore') save(true); }));
  subscriptions.push(engine.on('layerchange', ({ id, visible }) => { const checkbox = document.getElementById(`layer-${encodeURIComponent(id)}`) as HTMLInputElement | null; if (checkbox) checkbox.checked = visible; renderEntities(); save(false); }));
  subscriptions.push(engine.on('entitieschange', () => { entities = engine.getEntities(); renderEntities(); }));
  subscriptions.push(engine.on('error', ({ error }) => message(`Não foi possível carregar: ${error.message}`)), engine.on('warning', ({ message: text }) => message(text)));
  subscriptions.push(engine.on('clusteractivate', ({ entities: members }) => {
    clusterListeners.abort(); clusterListeners = new AbortController();
    if (members.every(e => JSON.stringify(e.geometry) === JSON.stringify(members[0].geometry))) {
      $('details-panel').hidden = false; $('details').replaceChildren(); const title = document.createElement('h2'); title.textContent = 'Escolher entidade'; $('details').append(title);
      for (const e of members) { const b = document.createElement('button'); b.textContent = e.label ?? e.id; b.addEventListener('click', () => engine.selectEntity(e.id), { signal: clusterListeners.signal }); $('details').append(b); }
    }
  }));
  subscriptions.push(engine.on('contentactivate', ({ content }) => {
    if (content.type !== 'url') { message(`Referência externa: ${content.title ?? content.ref}`); return; }
    try { const url = new URL(content.ref); if (['https:', 'http:'].includes(url.protocol)) window.open(url.href, '_blank', 'noopener,noreferrer'); else message('Este tipo de ligação precisa de uma integração da aplicação.'); }
    catch { message('Referência externa inválida.'); }
  }));
  $('search').addEventListener('input', () => { page = 0; renderEntities(); }, { signal });
  $('previous').addEventListener('click', () => { page--; renderEntities(); }, { signal }); $('next').addEventListener('click', () => { page++; renderEntities(); }, { signal });
  $('close-details').addEventListener('click', () => { engine.clearSelection(); $('details-panel').hidden = true; }, { signal });
  $('share').addEventListener('click', () => {
    save(false);
    void (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject(new Error('Clipboard unavailable'))).then(() => message('Ligação copiada.')).catch(() => {
      const field = document.createElement('input'); field.readOnly = true; field.value = location.href; field.setAttribute('aria-label', 'Ligação para partilhar'); $('message').replaceChildren(field); $('message').hidden = false; field.focus(); field.select();
    });
  }, { signal });
  const restore = async () => {
    if (!location.hash.includes('noxMap=')) return;
    restoring = true;
    try { await engine.applyViewState(location.hash); } catch (error) { if ((error as Error).name !== 'AbortError') message((error as Error).message); }
    finally { restoring = false; }
  };
  window.addEventListener('popstate', () => { void restore(); }, { signal });
  window.addEventListener('hashchange', () => { void restore(); }, { signal });
  const selector = $<HTMLSelectElement>('map-select');
  selector.addEventListener('change', () => { void engine.loadMap(selector.value).then(() => save(true)).catch(error => { if (error.name !== 'AbortError') { selector.value = engine.getState().mapId ?? ''; message(error.message); } }); }, { signal });
  try {
    const maps = await source.listMaps({ signal }); selector.replaceChildren();
    for (const map of maps) { const option = document.createElement('option'); option.value = map.mapId; option.textContent = map.title; selector.append(option); }
    $('catalog-status').textContent = `${maps.length} mapas disponíveis`; selector.disabled = false;
    if (location.hash.includes('noxMap=')) await restore(); else if (maps[0]) { await engine.loadMap(maps[0].mapId); save(false); }
    else message('O catálogo ainda não tem mapas.');
  } catch (error) { message((error as Error).message); }
  // Explicit development harness: omitted from production builds.
  if (import.meta.env.DEV) (window as Window & { noxEngine?: MapEngine }).noxEngine = engine;
  return () => { lifetime.abort(); entityListeners.abort(); layerListeners.abort(); clusterListeners.abort(); clearTimeout(timer); subscriptions.forEach(fn => fn()); cleanupControls(); engine.destroy(); };
}
