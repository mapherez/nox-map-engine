import type { ViewState } from './types.js';
import { cameraSchema, MapError } from './validation.js';
export interface ParsedViewState { state: ViewState; diagnostics: string[] }
export function serializeViewState(state: ViewState): string {
  const validated = parseViewState(encodeURIComponent(JSON.stringify(state)));
  if (validated.diagnostics.length) throw new MapError('INVALID_LINK', validated.diagnostics.join('; '));
  return `#noxMap=${encodeURIComponent(JSON.stringify(validated.state))}`;
}
export function parseViewState(value: string): ParsedViewState {
  if (value.length > 65536) throw new MapError('INVALID_LINK', 'Link is too long');
  let raw: unknown;
  try {
    const encoded = value.startsWith('#') ? new URLSearchParams(value.slice(1)).get('noxMap') : decodeURIComponent(value);
    if (!encoded) throw new Error('Missing noxMap state');
    raw = JSON.parse(encoded);
  } catch { throw new MapError('INVALID_LINK', 'Malformed map link'); }
  if (!raw || typeof raw !== 'object') throw new MapError('INVALID_LINK', 'Link state must be an object');
  const input = raw as Record<string, unknown>;
  if (input.version !== 1 || typeof input.mapId !== 'string' || !input.mapId || typeof input.snapshotId !== 'string' || !input.snapshotId) throw new MapError('INVALID_LINK', 'Unsupported version or missing map/snapshot identity');
  const state: ViewState = { version: 1, mapId: input.mapId, snapshotId: input.snapshotId }; const diagnostics: string[] = [];
  if (input.camera !== undefined) {
    const camera = cameraSchema.safeParse(input.camera);
    if (camera.success) state.camera = camera.data; else diagnostics.push('Ignored invalid camera');
  }
  if (input.selectedEntityId !== undefined) {
    if (typeof input.selectedEntityId === 'string' && input.selectedEntityId) state.selectedEntityId = input.selectedEntityId;
    else diagnostics.push('Ignored invalid entity ID');
  }
  if (input.layers !== undefined) {
    if (input.layers && typeof input.layers === 'object' && !Array.isArray(input.layers)) {
      state.layers = Object.create(null) as Record<string, boolean>;
      for (const [id, visible] of Object.entries(input.layers)) {
        if (typeof visible === 'boolean') state.layers[id] = visible; else diagnostics.push(`Ignored invalid visibility for ${id}`);
      }
    } else diagnostics.push('Ignored invalid layers');
  }
  return { state, diagnostics };
}
