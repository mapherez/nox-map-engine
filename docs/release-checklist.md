# Validação da release 0.1.0

## Automatizado

- Typecheck strict de packages, viewer e exemplos.
- Testes Vitest: validação, coordenadas, links, GeoJSON, providers, carregamento concorrente e mutações.
- CLI: raster não quadrado, bordas, escala, transparência, EXIF, JPEG e layout XYZ; publicação atómica sem overwrite.
- Playwright: Chromium, Firefox, WebKit e mobile emulado; picking com buracos, UI, deep links, histórico, resize, teclas e lifecycle.
- Touch Chromium emulado por CDP: tap, drag e pinch. Não equivale a dispositivo físico.
- Axe: ausência de violações serious/critical, antes/depois da selecção.
- Build ESM/declarações/standalone/exemplos; npm pack dry-run e smoke de imports publicados.
- Smoke de produção em subpasta: viewer/deep links e exemplos web, React e bridge WebView.
- Benchmark seed 7043: 10 000 markers, 1 000 polígonos, 101 000 vértices, tiles sintéticos 256 px numa grelha de 50 000 × 50 000.

Medição automatizada inicial no ambiente de desenvolvimento (2026-10-02), Chromium, tiles sintéticos em cache, gestos nativos de drag/wheel:

| Métrica | Desktop 1440 × 1000 | Pixel 7 emulado |
| --- | --- | --- |
| FPS médio | 58,6 | 58,7 |
| Frame time p95 | 16,8 ms | 16,7 ms |
| Selecção p95 | 34,1 ms | 22,7 ms |
| Aplicação do snapshot | 162,5 ms | 191,0 ms |
| Heap JS incremental pós-GC | 77,2 MB | 72,0 MB |
| Heap JS após 20 recarregamentos | 90,6 MB | 111,9 MB |

Ambiente: Windows x64, Intel i7-11700K, 16 CPUs lógicos, 64 GiB RAM. Os resultados JSON incluem hardware, browser, viewport, DPR, data e notas da medição, e são recriados por `npm run benchmark`. As amostras após os ciclos 1, 5, 10 e 20 variaram menos de 1 MB, medidas após painting, pedidos cancelados em repouso e GC. O benchmark rejeita crescimento superior a 16 MiB entre os ciclos 5 e 20. Esta execução não certifica os limites de produção abaixo.

## Antes de declarar os objectivos de performance cumpridos em produção

- Medir no desktop de referência (≥55 FPS médios) e num Android/iPhone de referência (≥30 FPS).
- Confirmar selecção p95 <100 ms, aplicação de snapshot <2 s desktop/<4 s mobile.
- Medir memória incremental total do renderer/browser: objectivos 256 MB desktop/160 MB mobile. JS heap pós-GC isoladamente não inclui todas as superfícies Canvas.
- Comparar memória antes/depois de 20 trocas/destruições. Tests confirmam cleanup de DOM; os dispositivos devem confirmar estabilização real da memória.
- Repetir com raster grande representativo, variedade de tiles, latência e perdas de rede. Tiles sintéticos repetidos não representam todos os custos de conteúdo real.
- Validar Safari/iOS, Chrome/Android, WebView nativa escolhida e screen reader. Os testes de WebKit e o exemplo de bridge não equivalem a estes ambientes.

## Fora da v1

Não bloquear esta biblioteca com implementação NoX Sync, editor, sincronização live, suporte GIS amplo ou armazenamento offline. Estas extensões usam os contratos definidos, sem inserir regras de domínio no core.
