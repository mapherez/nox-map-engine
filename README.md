# NoX Map Engine 2D

Engine 2D reutilizável para web e WebViews, com coordenadas locais ou geográficas, rendering Canvas, dados independentes do domínio e um viewer standalone.

## Começar

Requer Node.js 24 LTS e npm 11.

```sh
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173**. O catálogo incluído tem um mapa local ilustrado e um mapa geográfico de Lisboa. O mapa local funciona sem serviços externos; a demonstração geográfica usa tiles OpenStreetMap e requer rede.

```sh
npm run typecheck
npm test
npx playwright install chromium firefox webkit
npm run test:e2e
npm run benchmark
npm run build
npm run test:production
npm run verify:packages
```

O build produz packages ESM e declarações em `packages/*/dist`, o viewer em `apps/standalone/dist` e exemplos em `examples/dist`. O viewer pode ser alojado num servidor HTTP estático, incluindo numa subpasta. Não executar directamente por `file://`.

## Integrar

Após construir e instalar os packages locais:

```ts
import { createMapEngine } from '@nox-map/engine';
import { StaticHttpDataSource } from '@nox-map/data-source-static';
import '@nox-map/engine/style.css';

const engine = createMapEngine({
  container: document.querySelector<HTMLElement>('#map')!,
  dataSource: new StaticHttpDataSource({ catalogUrl: '/maps/catalog.json' }),
  gestures: 'cooperative'
});

const unsubscribe = engine.on('selectionchange', ({ entity }) => {
  // Metadata e referências mantêm o formato definido pela aplicação.
  console.log(entity?.metadata, entity?.contentRefs);
});

await engine.loadMap('local');
engine.setView({ center: [500, 400], zoom: 1 });
const link = engine.serializeViewState();

// Quando o host desmontar o componente:
unsubscribe();
engine.destroy();
```

O container necessita de altura e largura. A biblioteca não cria router, não altera a URL nem persiste dados. `upsertEntities()` e `removeEntities()` alteram apenas a sessão; recarregar o snapshot repõe os dados do provider.

`@nox-map/controls` oferece controlos e tooltips opcionais, com renderers DOM e cleanup. `@nox-map/core` contém tipos, validação, conversões, GeoJSON e codecs de links. Nenhum tipo OpenLayers faz parte dos contratos públicos.

Executar `npm run dev:examples` e abrir `/web/`, `/react/` ou `/webview/` em **http://127.0.0.1:5174**. O exemplo WebView mostra a fronteira com o host; a validação numa WebView nativa e em dispositivos físicos faz parte da checklist de release.

## Preparar um mapa grande

```sh
npm run prepare-map -- prepare ./mapa.png --out ./meu-mapa --map-id meu-mapa --units-per-pixel 0.1
```

Também aceita `--snapshot-id`, `--title`, `--format png|jpeg` e o conjunto `--center-x`, `--center-y`, `--zoom` para declarar o viewport inicial.

A CLI cria `catalog.json`, `map.json`, `entities.json`, thumbnail e tiles `z/x/y`. O destino tem de ser novo. A geração usa Sharp/libvips, normaliza EXIF e publica o directório apenas após concluir. Não há upload ou importação de imagens grandes no browser. O custo de descodificação no processo CLI depende do formato de entrada.

Servir o directório por HTTP e configurar `apps/standalone/public/config.json` com o URL do catálogo. O formato completo está em [docs/data-format.md](docs/data-format.md).

## Data sources e NoX Sync

`MapDataSource` disponibiliza `listMaps`, `getSnapshot` e `fetchAsset`, todos com `AbortSignal`. O provider gere credenciais e resolve assets, incluindo tiles e ícones. A aplicação pode fornecer um provider próprio sem backend obrigatório.

O adapter NoX Sync está reservado para uma fase posterior. O core não importa código nem assume endpoints, vaults ou autenticação do NoX Sync. [Contrato e integração](docs/api.md).

No standalone, `config.json` selecciona `provider`, `catalogUrl` e `gestures`. O provider incluído chama-se `static-http`. Um entry point alternativo pode chamar `bootstrapViewer({ 'meu-provider': factory })`, ou `startViewer({ dataSource })` directamente, para integrar outro transporte sem alterar o engine. Credenciais pertencem ao provider e não ao manifest ou deep link.

## Validação e limites

O benchmark reproduz uma cena de 50 000 × 50 000 unidades, 10 000 markers, 1 000 polígonos e 101 000 vértices. Usa tiles sintéticos repetidos e produz JSON em `artifacts/benchmarks`. A medição mobile é emulação; não comprova os objectivos num telemóvel real. Memória JS pós-GC também não inclui todas as superfícies Canvas ou memória do browser.

V1: raster local, pirâmide finita, XYZ EPSG:3857 e entidades WGS84. Sem editor, sincronização live, GIS arbitrário, cruzamentos do antimeridiano, offline completo, rotas ou 3D. Rasters simples estão limitados a 16M pixels; imagens maiores exigem tiles.

Consultar [arquitectura](docs/architecture.md), [API](docs/api.md) e [validação de release](docs/release-checklist.md).
