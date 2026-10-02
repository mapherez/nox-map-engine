import type { Entity } from '@nox-map/core';
import type { MapEngine } from '@nox-map/engine';
export interface RenderedContent { element: HTMLElement; dispose?: () => void }
export interface ControlsOptions {
  container: HTMLElement; detailsContainer?: HTMLElement;
  tooltipRenderer?: (entity: Entity) => RenderedContent;
  detailRenderer?: (entity: Entity) => RenderedContent;
}
function button(text: string, name: string, action: () => void): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-label', name); b.title = name; b.addEventListener('click', action); return b;
}
export function renderEntityDetails(engine: MapEngine, entity: Entity): HTMLElement {
  const section = document.createElement('section'); section.className = 'nox-entity-details';
  const heading = document.createElement('h2'); heading.textContent = entity.label ?? entity.id;
  const description = document.createElement('p'); description.textContent = entity.description ?? 'Sem descrição.';
  section.append(heading, description);
  if (entity.metadata && Object.keys(entity.metadata).length) {
    const list = document.createElement('dl');
    for (const [key, value] of Object.entries(entity.metadata)) {
      const dt = document.createElement('dt'); dt.textContent = key;
      const dd = document.createElement('dd'); dd.textContent = typeof value === 'string' ? value : JSON.stringify(value);
      list.append(dt, dd);
    }
    section.append(list);
  }
  entity.contentRefs?.forEach((ref, index) => section.append(button(ref.title ?? ref.type, ref.title ?? ref.type, () => engine.activateContent(entity.id, index))));
  section.append(button('Centrar no mapa', 'Centrar esta entidade no mapa', () => engine.focusEntity(entity.id)));
  return section;
}
export function mountControls(engine: MapEngine, options: ControlsOptions): () => void {
  const toolbar = document.createElement('div'); toolbar.className = 'nox-toolbar'; toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', 'Navegação do mapa');
  const zoom = (delta: number) => { const camera = engine.getState().camera; if (camera) engine.setView({ ...camera, zoom: camera.zoom + delta }); };
  toolbar.append(button('+', 'Aproximar', () => zoom(1)), button('−', 'Afastar', () => zoom(-1)), button('⌖', 'Enquadrar mapa', () => { if (engine.getState().mapId) engine.fitBounds(); }));
  const tooltip = document.createElement('div'); tooltip.className = 'nox-tooltip'; tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  options.container.append(toolbar, tooltip);
  let tooltipDispose: (() => void) | undefined, detailsDispose: (() => void) | undefined, hovered: string | undefined;
  const cleanup = [engine.on('hoverchange', ({ entity, pixel }) => {
    if (!entity || !pixel) { tooltip.hidden = true; hovered = undefined; tooltipDispose?.(); tooltipDispose = undefined; return; }
    if (hovered !== entity.id) {
      tooltipDispose?.(); tooltipDispose = undefined; hovered = entity.id; tooltip.replaceChildren();
      if (options.tooltipRenderer) { const rendered = options.tooltipRenderer(entity); tooltip.append(rendered.element); tooltipDispose = rendered.dispose; }
      else tooltip.textContent = entity.label ?? entity.id;
    }
    tooltip.hidden = false;
    const box = options.container.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(pixel[0] + 16, box.width - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(pixel[1] + 16, box.height - tooltip.offsetHeight - 8))}px`;
  }), engine.on('mapchange', () => { tooltip.hidden = true; hovered = undefined; tooltipDispose?.(); tooltipDispose = undefined; }), engine.on('selectionchange', ({ entity }) => {
    if (!options.detailsContainer) return;
    detailsDispose?.(); detailsDispose = undefined; options.detailsContainer.replaceChildren();
    if (!entity) return;
    const rendered = options.detailRenderer?.(entity);
    options.detailsContainer.append(rendered?.element ?? renderEntityDetails(engine, entity)); detailsDispose = rendered?.dispose;
  })];
  return () => { cleanup.forEach(fn => fn()); tooltipDispose?.(); detailsDispose?.(); toolbar.remove(); tooltip.remove(); options.detailsContainer?.replaceChildren(); };
}
