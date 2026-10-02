import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from '../tests/fixtures.js';
import { prepareMap } from '../packages/cli/src/index.js';
import type { MapSnapshot } from '@nox-map/core';
const root = 'apps/standalone/public/maps';
await mkdir(join(root, 'local'), { recursive: true }); await mkdir(join(root, 'lisbon'), { recursive: true });
const map = fixture(); map.title = 'Costa de Esmeralda'; map.initialView = { center: [500, 400], zoom: -.25 };
map.sources = [{ id: 'illustration', type: 'image', width: 1000, height: 800, unitsPerPixel: 1, origin: [0, 0], asset: { uri: './base.svg' }, attribution: 'Mapa demonstrativo · NoX Atlas' }];
map.layers.unshift({ id: 'base', type: 'raster', sourceId: 'illustration', title: 'Mapa base', order: 0, visible: true, opacity: 1 });
map.layers[1].style = { fill: '#a1dfa025', stroke: '#a6d39a', strokeWidth: 1.5, labelMinZoom: 1 };
if (map.layers[2].type === 'vector') map.layers[2].cluster = { distance: 40 }; map.layers[2].style = { labelMinZoom: -.8 };
map.entities[0] = { ...map.entities[0], label: 'Observatório', description: 'Um ponto elevado sobre a costa. Selecciona entidades para consultar informação e referências externas.', metadata: { Categoria: 'Ponto de interesse', Altitude: '148 m' }, contentRefs: [{ type: 'url', ref: 'https://github.com/mapherez/nox-map-engine', title: 'Ver projecto' }] };
map.entities[1].label = 'Reserva do Vale'; map.entities[1].description = 'Região interactiva com um buraco central: a área interior fica fora da selecção.';
map.entities.push(
  { id: 'harbor', label: 'Porto de Maré', layerId: 'points', geometry: { type: 'Point', coordinates: [750, 280] }, metadata: { Categoria: 'Porto' }, description: 'O encontro entre a vila e o mar.' },
  { id: 'garden', label: 'Jardim das Fontes', layerId: 'points', geometry: { type: 'Point', coordinates: [280, 520] }, style: { fill: '#ffc978' }, metadata: { Categoria: 'Jardim' } },
  { id: 'lighthouse', label: 'Farol do Sul', layerId: 'points', geometry: { type: 'Point', coordinates: [690, 660] }, description: 'Um ponto de referência na costa sul.' },
  { id: 'gate', label: 'Porta da Serra', layerId: 'points', geometry: { type: 'Point', coordinates: [420, 140] }, metadata: { Categoria: 'Miradouro' } },
  { id: 'town', label: 'Vila Antiga', layerId: 'regions', geometry: { type: 'MultiPolygon', coordinates: [[[[420, 300], [590, 280], [630, 460], [470, 490], [420, 300]]], [[[600, 520], [680, 490], [710, 570], [650, 600], [600, 520]]]] }, style: { stroke: '#ffc978', fill: '#ffc97820', labelMinZoom: 1 }, metadata: { Categoria: 'Região' } }
);
await writeFile(join(root, 'local/map.json'), JSON.stringify(map, null, 2) + '\n');
const buildings = Array.from({ length: 85 }, (_, i) => {
  const col = i % 10, row = Math.floor(i / 10); return `<rect x="${355 + col * 31}" y="${240 + row * 32}" width="${15 + i % 3 * 3}" height="${13 + i % 4 * 2}" rx="2" fill="${i % 3 ? '#48614f' : '#68705a'}" stroke="#203e31" stroke-width="2"/>`;
}).join('');
const contours = Array.from({ length: 11 }, (_, i) => `<ellipse cx="180" cy="200" rx="${55 + i * 20}" ry="${32 + i * 15}" transform="rotate(-25 180 200)" fill="none" stroke="#74976b" stroke-opacity=".24"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800">
<defs><pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#86aa8e" stroke-opacity=".08"/></pattern><pattern id="trees" width="24" height="28" patternUnits="userSpaceOnUse"><path d="M12 4l5 12H7z" fill="#739361" opacity=".3"/></pattern></defs>
<rect width="1000" height="800" fill="#304e3b"/><rect width="1000" height="800" fill="url(#grid)"/>
<path d="M810 0 Q690 120 795 230 Q875 330 765 440 Q680 550 758 650 Q805 760 710 800H1000V0Z" fill="#173b3f"/>
<path d="M810 0 Q690 120 795 230 Q875 330 765 440 Q680 550 758 650 Q805 760 710 800" fill="none" stroke="#7aab92" stroke-opacity=".6" stroke-width="5"/>
<path d="M818 0 Q698 120 803 230 Q883 330 773 440 Q688 550 766 650 Q813 760 718 800" fill="none" stroke="#629590" stroke-opacity=".3" stroke-width="20"/>
<path d="M0 360 Q150 300 200 480 Q280 650 450 590 Q560 580 710 800" fill="none" stroke="#173b3f" stroke-width="42"/><path d="M0 360 Q150 300 200 480 Q280 650 450 590 Q560 580 710 800" fill="none" stroke="#669990" stroke-opacity=".3" stroke-width="30"/>
<path d="M30 40Q370 0 340 260T80 350Z" fill="url(#trees)"/>${contours}
<g stroke="#a6a58b" fill="none"><path d="M-50 180Q270 450 420 140T850 -50M280 850Q280 520 500 400T800 260M690 660Q510 590 500 400T520 -30" stroke="#243b2d" stroke-width="16"/><path d="M-50 180Q270 450 420 140T850 -50M280 850Q280 520 500 400T800 260M690 660Q510 590 500 400T520 -30" stroke-width="5"/>
<path d="M360 210L710 550M330 300L640 610M300 400L580 700M320 510L780 260M300 600L740 360M400 690L720 470" stroke="#94a081" stroke-opacity=".38" stroke-width="3"/></g>${buildings}
<g stroke="#8d9e83" stroke-width="8"><path d="M752 263l95 -24M762 280l92 -15M771 300l72 -8"/></g>
<g font-family="system-ui,sans-serif" fill="#bcceaf" opacity=".5" font-size="13" letter-spacing="4"><text x="390" y="590">VILA ANTIGA</text><text x="100" y="80">SERRA DO VALE</text><text x="875" y="440" transform="rotate(90 875 440)">MAR DE ESMERALDA</text></g>
</svg>`;
await writeFile(join(root, 'local/base.svg'), svg);
await sharp(Buffer.from(svg)).resize(400).png().toFile(join(root, 'local/thumbnail.png'));
await sharp(Buffer.from(svg)).resize(256, 256, { fit: 'cover' }).png().toFile(join(root, 'local/benchmark-tile.png'));
const geographic: MapSnapshot = {
  schemaVersion: 1, mapId: 'lisbon', snapshotId: 'base', title: 'Lisboa', coordinateSystem: { kind: 'geographic', crs: 'EPSG:4326' },
  bounds: [-9.3, 38.6, -9.0, 38.85], initialView: { center: [-9.139, 38.722], zoom: 13 },
  sources: [{ id: 'osm', type: 'xyz', template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', tileSize: 256, minLevel: 0, maxLevel: 19, attribution: '© OpenStreetMap contributors' }],
  layers: [{ id: 'base', type: 'raster', sourceId: 'osm', title: 'Mapa base', order: 0, visible: true, opacity: 1 }, { id: 'points', type: 'vector', title: 'Pontos de interesse', order: 1, visible: true, opacity: 1, cluster: { distance: 40 }, style: { textColor: '#ffffff' } }],
  entities: [{ id: 'castle', layerId: 'points', label: 'Castelo de São Jorge', geometry: { type: 'Point', coordinates: [-9.1335, 38.7139] }, metadata: { Cidade: 'Lisboa' } }, { id: 'park', layerId: 'points', label: 'Parque Eduardo VII', geometry: { type: 'Point', coordinates: [-9.1538, 38.7288] } }]
};
await writeFile(join(root, 'lisbon/map.json'), JSON.stringify(geographic, null, 2) + '\n');
await writeFile(join(root, 'catalog.json'), JSON.stringify({ maps: [
  { mapId: 'local', title: map.title, currentSnapshotId: 'base', thumbnail: { uri: './local/thumbnail.png' }, snapshots: { base: './local/map.json' } },
  { mapId: 'lisbon', title: geographic.title, currentSnapshotId: 'base', snapshots: { base: './lisbon/map.json' } }
] }, null, 2) + '\n');
await mkdir('artifacts', { recursive: true });
await sharp({ create: { width: 513, height: 301, channels: 4, background: '#134550' } }).composite([{ input: await sharp({ create: { width: 256, height: 301, channels: 4, background: '#cb9833' } }).png().toBuffer(), left: 0, top: 0 }]).png().toFile('artifacts/cli-input.png');
const prepared = await prepareMap({ input: 'artifacts/cli-input.png', out: 'artifacts/prepared', mapId: 'prepared' }).catch(error => { if (!error.message.includes('already exists')) throw error; });
console.log('Created demo maps and CLI reference fixture.', prepared?.sources[0]);
