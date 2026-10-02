# Formato de dados v1

## Catálogo estático

```json
{
  "maps": [{
    "mapId": "floor", "title": "Planta", "currentSnapshotId": "base",
    "snapshots": { "base": "./floor/map.json" }
  }]
}
```

`snapshots` mapeia IDs para manifests. Thumbnail é opcional (`{ "uri": "./thumbnail.png" }`). Referências relativas ao catálogo são resolvidas nesse contexto.

## Manifest local

```json
{
  "schemaVersion": 1, "mapId": "floor", "snapshotId": "base", "title": "Planta",
  "coordinateSystem": { "kind": "local", "units": "metres" },
  "bounds": [0, 0, 100, 80],
  "initialView": { "center": [50, 40], "zoom": 2 },
  "sources": [{
    "id": "raster", "type": "raster-pyramid", "template": "./tiles/{z}/{x}/{y}.png",
    "origin": [0, 0], "width": 10000, "height": 8000,
    "unitsPerPixel": 0.01, "tileSize": 256, "maxLevel": 6
  }],
  "layers": [
    { "id": "base", "title": "Base", "type": "raster", "sourceId": "raster", "order": 0, "visible": true, "opacity": 1 },
    { "id": "poi", "title": "Pontos", "type": "vector", "order": 1, "visible": true, "opacity": 1, "cluster": { "distance": 40 } }
  ],
  "entities": [{
    "id": "entrance", "layerId": "poi", "label": "Entrada",
    "geometry": { "type": "Point", "coordinates": [12, 20] },
    "metadata": { "category": "access" },
    "contentRefs": [{ "type": "document", "ref": "document-id", "title": "Detalhes" }]
  }]
}
```

Pode substituir `entities` por `entitiesUrl` no provider estático. Este ficheiro contém um array de entidades e é carregado antes de devolver o snapshot completo. Fontes, templates e ícones são relativos ao manifest. Referências de conteúdo mantêm o significado definido pelo host.

Bounds são `[minX,minY,maxX,maxY]`, com dimensão positiva. Min/max zoom são opcionais. Sem initialView, o engine enquadra os bounds. Imagens pequenas usam `type: image` e `asset: { uri }`, com a mesma colocação local.

## Pirâmide local

Nível zero é o mais reduzido; maxLevel representa pixels originais. Resolução no nível z: `unitsPerPixel * 2^(maxLevel-z)`. x cresce à direita; y cresce abaixo. Tiles são 256 ou 512 px e sem overlap. A região desenhada é recortada pelas dimensões originais; padding das bordas não muda coordenadas. A CLI emite sempre 256 px e normaliza o layout libvips z/y/x para z/x/y.

## Mapas geográficos

Usar `coordinateSystem: { kind: "geographic", crs: "EPSG:4326" }`. Bounds, câmara e entidades são `[longitude,latitude]`. Sources: `type: xyz`, `template`, `tileSize`, `minLevel`, `maxLevel`, `attribution`. Os tiles representam EPSG:3857; 512 px mantém a sua grelha de nível própria. Zoom público continua a seguir a convenção XYZ de referência de 256 px.

`importGeoJSON()` aceita FeatureCollection WGS84, Point/Polygon/MultiPolygon e IDs estáveis. Sem ID no ficheiro, fornecer a função de mapeamento. O importer não gera IDs a partir da posição nem interpreta CRS custom.

## Layers, entidades e estilos

Layers têm IDs únicos, ordem finita, visible e opacity 0–1. Min/max zoom, style e clustering são opcionais. Só layers vectoriais recebem entidades.

Entidades têm IDs únicos por mapa/snapshot e geometria explícita. Rings de polígonos são fechados; o primeiro ring é exterior e os restantes representam buracos. Metadata é JSON; não são permitidos ciclos ou valores não serializáveis. Reutilizar IDs entre snapshots quando representam a mesma entidade.

Estilos declarativos: fill, stroke, strokeWidth, radius, icon (`AssetRef`), size e anchor, textColor, font, labelMinZoom/labelMaxZoom e priority. Hover/selected podem declarar overrides. Precedência: defaults → layer → estilo nomeado (`styleId`) → entidade → callback local → override de estado. Priority controla a ordem interna do estilo; layers mantêm a ordem principal. O renderer faz decluttering de labels/símbolos.

## Segurança de apresentação

Labels, descrição e metadata são apresentados como texto. O viewer só abre referências URL HTTP(S) após activação do utilizador; outros tipos são responsabilidade do host. Autenticação pertence ao provider e não é serializada nos links.
