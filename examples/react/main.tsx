import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StaticHttpDataSource } from '@nox-map/data-source-static';
import { MapView } from './MapView';
const dataSource = new StaticHttpDataSource({ catalogUrl: new URL('../maps/catalog.json', document.baseURI).href });
function App() { const [selection, setSelection] = useState(''); return <><h1>React integration</h1><MapView dataSource={dataSource} mapId="local" onSelect={entity => setSelection(entity?.label ?? '')} /><p role="status">{selection}</p></>; }
createRoot(document.getElementById('root')!).render(<App />);
