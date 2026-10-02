# Arquitectura e decisões

## Fronteiras

O core é TypeScript puro, sem runtime DOM ou imports OpenLayers. Os tipos do renderer port referem o container HTML mas a validação, coordenadas e codecs podem ser usados em Node. O engine orquestra dados/estado/eventos. O adapter OpenLayers é responsável por projecção, navegação, rendering e picking. O provider controla transporte. O viewer e os controlos consomem a API pública.

Packages: `core`, `engine`, `renderer-openlayers`, `data-source-static`, `controls`, `cli`. Todos têm exports explícitos. A CLI e Sharp não entram no bundle do browser.

## ADR 001 — Rendering

OpenLayers foi escolhido por combinar projecções locais, tiles raster e cartografia geográfica. DOM/SVG seria inadequado como representação individual de milhares de entidades. Canvas/PixiJS próprios exigiriam construir gestão de tiles, cartografia, labels e picking. OpenSeadragon cobre imagens, mas não resolve sozinho o conjunto de entidades/cartografia. MapLibre tem foco geográfico. O produto define a sua API e mantém um renderer port substituível; a troca de renderer exige implementar os mesmos comportamentos, não apenas trocar um import.

Canvas: tiles raster, pontos/labels em VectorLayer, polígonos em VectorImageLayer durante gestos, destaques separados. Clusters preservam membros durante interacção/animação e recalculam no repouso. Isto reduz o trabalho de zoom contínuo, com a contrapartida de distância temporariamente variável durante o gesto. Distância no repouso: 40 px CSS por defeito quando configurada no layer.

## ADR 002 — Coordenadas

Locais: x-direita, y-baixo; renderer usa `[x,-y]`. Um raster define origem, dimensão em pixels e escala uniforme em unidades/pixel. Zoom local zero significa uma unidade/pixel CSS. Geográfico: API WGS84 `[longitude,latitude]`, renderer Web Mercator. Não há geometrias que atravessem o antimeridiano; latitudes acima de ±85.0511287798066 não são aceites.

Pixels CSS são a fronteira pública. DPR apenas dimensiona o canvas e é limitado a 2 por defeito. A câmara não depende do nível da pirâmide.

## ADR 003 — Dados e versões

Map ID identifica o mapa. Snapshot ID identifica uma publicação imutável. Schema version identifica o formato. ViewState contém navegação. Os providers devolvem o ID concreto do estado corrente e rejeitam versões explicitamente inexistentes. Alterações locais não criam snapshots e desaparecem no reload.

O provider estático lê catálogo/manifest/entidades e resolve assets relativos ao manifest. Outros providers podem mapear referências opacas, URLs assinadas ou blobs. NoX Sync é uma integração futura. Todos os pedidos admitem cancelamento; falhas não activam loops automáticos de autenticação.

## Lifecycle e consistência

Um carregamento novo aborta o anterior. O snapshot é validado e o renderer prepara layers antes de substituir a vista actual. Só a geração mais recente pode activar o resultado. O mapa abre sem esperar todos os tiles; falhas de assets são recuperáveis. Recursos/listeners/observers são próprios de cada instância.

Entidades e estilos são copiados/validados na fronteira. Updates são validados por inteiro antes de aplicar. Os sources vectoriais mantêm índices espaciais. As mutações do renderer são agrupadas por source. Não existe streaming espacial ou backend de persistência na v1.

## Extensões futuras

Novos providers não alteram o renderer; novas fontes exigem novos adapters de source e extensão versionada do modelo; novos renderers implementam o port. Streaming espacial exigirá um contrato adicional, mantendo o provider de snapshots. Estados históricos podem usar IDs estáveis de entidades e snapshot IDs sem misturar navegação, timelines ou regras do domínio no core.
