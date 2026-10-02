import { useEffect, useRef } from 'react';
import { createMapEngine, type MapEngine } from '@nox-map/engine';
import type { Entity, MapDataSource } from '@nox-map/core';
import '../../packages/engine/src/style.css';
export function MapView({ dataSource, mapId, onSelect }: { dataSource: MapDataSource; mapId: string; onSelect?: (entity?: Entity) => void }) {
  const container = useRef<HTMLDivElement>(null), engine = useRef<MapEngine | undefined>(undefined), listener = useRef(onSelect);
  listener.current = onSelect;
  useEffect(() => {
    const instance = createMapEngine({ container: container.current!, dataSource }); engine.current = instance;
    instance.on('loadingchange', ({ loading }) => container.current?.setAttribute('aria-busy', String(loading)));
    const unsubscribe = instance.on('selectionchange', ({ entity }) => listener.current?.(entity));
    return () => { unsubscribe(); instance.destroy(); engine.current = undefined; };
  }, [dataSource]);
  useEffect(() => {
    void engine.current?.loadMap(mapId).catch(error => { if (error.name !== 'AbortError') console.error(error); });
  }, [mapId, dataSource]);
  return <div ref={container} style={{ height: '70vh' }} />;
}
