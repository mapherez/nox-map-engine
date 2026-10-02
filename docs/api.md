# API e providers

## Engine

`createMapEngine({ container, dataSource, gestures?, profile?, maxPixelRatio?, renderer?, style? })` cria uma instância. Container precisa de dimensões. Gestures: cooperative por defeito, exclusive no standalone. Profile pode fixar desktop/mobile; por defeito usa pointer coarse. MaxPixelRatio por defeito 2. `renderer` permite um port alternativo sem tipos OpenLayers. `style(entity,{zoom,state})` fornece estilos locais.

- `loadMap(mapId,{snapshotId?,initialView?,viewState?})`: activa snapshot validado. Rejeita com AbortError quando cancelado/superseded.
- `getState`, `getMap`, `getEntity`, `getEntities`, `getLayers`: cópias dos dados públicos; getMap omite entidades.
- `setView({center,zoom})`, `fitBounds(bounds?,padding?)`, `focusEntity(id)`: comandos de câmara. Zoom é limitado pelos limites do mapa.
- `mapToScreen`, `screenToMap`: pixels CSS relativos ao container; sem conversões de DPR no consumidor.
- `pick(pixel)`: todos os hits ordenados pela apresentação; cluster contém os IDs de membros.
- `setLayerVisibility`, `setLayerOpacity`: valores da sessão.
- `selectEntity`, `clearSelection`: selecção única. Esconder layer/remover entidade limpa-a.
- `upsertEntities`, `removeEntities`: mutações em lote, locais à sessão. Upsert substitui a entidade completa.
- `activateContent(entityId,index)`: emite referência, sem fetch automático.
- `serializeViewState`, `parseViewState`, `applyViewState`: navegação sem manipular a URL.
- `on(type,callback)`: devolve unsubscribe.
- `destroy`: idempotente; comandos posteriores rejeitam.

Eventos tipados: loadingchange, mapchange, viewchange, layerchange, entitieschange, selectionchange, hoverchange, clusteractivate, contentactivate, error e warning. Viewchange distingue causa interaction/api/restore e settled. Hosts devem actualizar URLs no repouso e evitar round-trips de render através da framework em cada frame.

## Links

Formato `#noxMap=<JSON percent-encoded>`, versão 1. Só inclui mapa/snapshot, câmara, selecção e visibilidade. Campos desconhecidos não são serializados. Campos opcionais inválidos originam diagnostics; identidade ou versão inválidas rejeitam o link. Limite de parsing: 64 KiB.

Precedência: câmara explícita do link → entidade sem câmara → initialView do host → initialView do manifest → bounds. Uma entidade activa o seu layer. Sem câmara, markers preservam o zoom e polígonos são enquadrados. Entidade inexistente gera warning e mantém o mapa; mapa/snapshot inexistentes rejeitam.

Standalone usa replaceState para pan/zoom e pushState para mapa/selecção. Back/forward restaura sem persistir dados locais.

## Implementar MapDataSource

```ts
import type { MapDataSource } from '@nox-map/core';

const provider: MapDataSource = {
  async listMaps({ signal }) { /* catálogo normalizado */ throw new Error('Implement'); },
  async getSnapshot({ mapId, snapshotId }, { signal }) { /* snapshot completo */ throw new Error('Implement'); },
  async fetchAsset({ uri }, { mapId, snapshotId, signal }) { /* Blob */ throw new Error('Implement'); }
};
```

O provider pode converter uma API externa, ficheiros ou referências opacas. getSnapshot sem snapshotId resolve o estado corrente e devolve ID concreto; com ID explícito, não faz fallback silencioso. IDs devolvidos devem corresponder ao pedido. Pedidos devem respeitar signal; o engine também protege contra providers que entreguem respostas antigas.

Autenticação está fora dos dados. O provider estático admite `request(url,signal)`, por exemplo para cookies ou headers limitados ao origin autorizado. Não enviar o mesmo bearer token indiscriminadamente para todos os URLs de assets: um provider que usa headers deve limitar destinos. Não introduzir credenciais em manifestos/links.

Não existem métodos write ou subscribe no contrato v1. A aplicação observa entitieschange e pode persistir por outro serviço. Para um futuro adapter NoX Sync: mapear catálogo, snapshots e referências de blobs; manter endpoints e IDs de vault apenas dentro desse adapter. A suite `tests/data-source-contract.ts` pode ser reutilizada para testar a conformidade.
