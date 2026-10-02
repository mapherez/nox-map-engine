import { test, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { cpus, platform, arch, totalmem } from 'node:os';
import type { MapEngine } from '@nox-map/engine';
declare global { interface Window { noxEngine: MapEngine } }
test('measures the seeded 50k raster / 11k entity scene', async ({ page }, info) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto('/'); await page.waitForFunction(() => window.noxEngine?.getState().mapId === 'local');
  await cdp.send('HeapProfiler.collectGarbage');
  const baselineHeap = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize')!.value;
  await page.goto('/?benchmark'); await expect(page.locator('#map-title')).toHaveText('Benchmark 50k');
  await page.waitForFunction(() => window.noxEngine?.getState().loading === false);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const samples = { frames: [] as number[], recording: true, last: 0 };
    (window as Window & { frameSamples?: typeof samples }).frameSamples = samples;
    const frame = (now: number) => { if (!samples.recording) return; if (samples.last) samples.frames.push(now - samples.last); samples.last = now; requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  const box = (await page.locator('#map').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 90; i++) { await page.mouse.move(cx + Math.sin(i / 20) * 90, cy + Math.cos(i / 20) * 50); await page.waitForTimeout(12); }
  await page.mouse.up();
  for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, i < 15 ? -20 : 20); await page.waitForTimeout(12); }
  const result = await page.evaluate(async () => {
    const engine = window.noxEngine, path = '/src/testing.ts';
    const { benchmarkSnapshot } = await import(path);
    const samples = (window as unknown as Window & { frameSamples: { frames: number[]; recording: boolean } }).frameSamples;
    samples.recording = false; const timings = samples.frames, selection: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now(); engine.selectEntity(`p-${i}`); await new Promise(requestAnimationFrame); selection.push(performance.now() - start);
    }
    const sorted = [...timings].sort((a, b) => a - b), selections = [...selection].sort((a, b) => a - b);
    const snapshot = benchmarkSnapshot();
    const p = '/src/testing.ts', { createMapEngine, MemoryDataSource } = await import(p);
    const container = document.createElement('div'); container.style.cssText = 'position:fixed;width:800px;height:600px;top:0;left:0'; document.body.append(container);
    const newEngine = createMapEngine({ container, dataSource: new MemoryDataSource([snapshot]), gestures: 'exclusive' });
    const beforeLoad = performance.now(); await newEngine.loadMap('benchmark'); const loadMs = performance.now() - beforeLoad; newEngine.destroy(); container.remove();
    return {
      averageFps: 1000 / (timings.reduce((a, b) => a + b) / timings.length), frameP95Ms: sorted[Math.floor(sorted.length * .95)],
      selectionP95Ms: selections[Math.floor(selections.length * .95)], snapshotApplyMs: loadMs,
      userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
      entities: engine.getEntities().length, raster: [50000, 50000], vertices: 101000,
      note: 'Native mouse drag/wheel; synthetic repeated raster tiles; mobile is browser emulation, not physical-device evidence.'
    };
  });
  await cdp.send('HeapProfiler.collectGarbage');
  const heapBytes = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize')!.value;
  const lifecycleHeapBytes: number[] = [];
  for (let i = 0; i < 20; i++) {
    await page.evaluate(async () => {
      await window.noxEngine.loadMap('benchmark');
      // OpenLayers releases frame resources in its post-render task, after painting.
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    if ([0, 4, 9, 19].includes(i)) {
      // Let aborted network/decode promises and browser post-render work settle.
      // Snapshot activation deliberately does not await tiles.
      await page.waitForTimeout(1000);
      await cdp.send('HeapProfiler.collectGarbage');
      lifecycleHeapBytes.push((await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize')!.value);
    }
  }
  const report = { ...result, heapBytes, incrementalHeapBytes: heapBytes - baselineHeap, baselineHeapBytes: baselineHeap,
    lifecycle: { cycles: 20, sampleCycles: [1, 5, 10, 20], heapBytes: lifecycleHeapBytes },
    environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem() },
    recordedAt: new Date().toISOString() };
  expect(result.entities).toBe(11000); expect(result.averageFps).toBeGreaterThan(0);
  expect(lifecycleHeapBytes.at(-1)! - lifecycleHeapBytes[1]).toBeLessThan(16 * 1024 * 1024);
  await mkdir('artifacts/benchmarks', { recursive: true }); await writeFile(`artifacts/benchmarks/${info.project.name}.json`, JSON.stringify(report, null, 2));
  console.log(`${info.project.name}: ${JSON.stringify(report)}`);
});
