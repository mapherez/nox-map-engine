import { test, expect } from '@playwright/test';
import type { MapEngine } from '@nox-map/engine';
declare global { interface Window { noxEngine: MapEngine } }
test.beforeEach(async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-title')).toHaveText('Costa de Esmeralda');
  await page.waitForFunction(() => window.noxEngine?.getState().loading === false);
});
test('loads raster, navigates, picks points and exposes metadata without page errors', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await expect(page.locator('#map canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Observatório', exact: false }).click();
  await expect(page.locator('#details h2')).toHaveText('Observatório'); await expect(page.locator('#details')).toContainText('148 m');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  const zoom = await page.evaluate(() => window.noxEngine.getState().camera!.zoom);
  await page.getByRole('button', { name: 'Aproximar', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.noxEngine.getState().camera!.zoom)).toBeCloseTo(zoom + 1);
  const selected = await page.evaluate(() => {
    const e = window.noxEngine; e.setView({ center: [500, 400], zoom: 1 });
    return e.pick(e.mapToScreen([500, 400])!).flatMap(h => h.entityIds);
  }); expect(selected).toContain('point');
  await page.screenshot({ path: `output/playwright/${info.project.name}.png`, fullPage: true }); expect(errors).toEqual([]);
});
test('respects polygon holes and hidden layers', async ({ page }) => {
  const result = await page.evaluate(() => {
    const e = window.noxEngine; e.setView({ center: [200, 200], zoom: 1 });
    const inside = e.pick(e.mapToScreen([120, 120])!).flatMap(h => h.entityIds);
    const hole = e.pick(e.mapToScreen([200, 200])!).flatMap(h => h.entityIds);
    e.setLayerVisibility('regions', false);
    const hidden = e.pick(e.mapToScreen([120, 120])!).flatMap(h => h.entityIds);
    return { inside, hole, hidden };
  });
  expect(result.inside).toContain('region'); expect(result.hole).not.toContain('region'); expect(result.hidden).not.toContain('region');
});
test('round-trips coordinates, resizes and handles incremental mutations', async ({ page }) => {
  const result = await page.evaluate(() => {
    const e = window.noxEngine, point: [number, number] = [500, 400]; e.setView({ center: point, zoom: .43 });
    const pixel = e.mapToScreen(point)!, round = e.screenToMap(pixel)!;
    e.upsertEntities([{ id: 'new', layerId: 'points', label: '<script>bad()</script>', geometry: { type: 'Point', coordinates: [500, 400] } }]); e.selectEntity('new');
    return { round, state: e.getState() };
  });
  expect(result.round[0]).toBeCloseTo(500, 6); expect(result.round[1]).toBeCloseTo(400, 6);
  await expect(page.locator('#details h2')).toHaveText('<script>bad()</script>');
  await page.setViewportSize({ width: 800, height: 700 });
  await page.evaluate(() => window.noxEngine.removeEntities(['new'])); await expect(page.locator('#details-panel')).toBeHidden();
});
test('restores deep links and selection with browser history', async ({ page }) => {
  await page.getByRole('button', { name: 'Observatório', exact: false }).click();
  const url = page.url(); await page.reload(); await expect(page.locator('#details h2')).toHaveText('Observatório');
  expect(page.url()).toBe(url);
  await page.getByRole('button', { name: 'Farol do Sul', exact: false }).click(); await expect(page.locator('#details h2')).toHaveText('Farol do Sul');
  await page.goBack(); await expect(page.locator('#details h2')).toHaveText('Observatório');
});
test('wheel and focused keyboard pan/zoom, drag does not select', async ({ page }, info) => {
  if (info.project.name === 'mobile-chromium') test.skip(true, 'Physical touch gesture validation is separate; mobile API/UI flows run in other tests');
  const box = (await page.locator('#map').boundingBox())!;
  const before = await page.evaluate(() => window.noxEngine.getState().camera!);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -120);
  await expect.poll(() => page.evaluate(() => window.noxEngine.getState().camera!.zoom)).toBeGreaterThan(before.zoom);
  await page.locator('#map').focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.noxEngine.getState().camera!.center[0])).toBeGreaterThan(before.center[0]);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(350); expect(await page.evaluate(() => window.noxEngine.getState().selectedEntityId)).toBeUndefined();
});
test('switches to geographic XYZ with a mock tile service', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', path: 'apps/standalone/public/maps/local/thumbnail.png' }));
  await page.selectOption('#map-select', 'lisbon'); await expect(page.locator('#map-title')).toHaveText('Lisboa');
  const point = await page.evaluate(() => {
    const e = window.noxEngine; e.focusEntity('castle'); return e.screenToMap(e.mapToScreen([-9.1335, 38.7139])!)!;
  }); expect(point[0]).toBeCloseTo(-9.1335, 6); expect(point[1]).toBeCloseTo(38.7139, 6);
  await expect(page.locator('#attribution')).toContainText('OpenStreetMap');
});
test('cleans up twenty lifecycles and supports independent instances', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/src/testing.ts', { createMapEngine, MemoryDataSource } = await import(path);
    const snapshot = { ...window.noxEngine.getMap(), entities: window.noxEngine.getEntities() };
    snapshot.sources = []; snapshot.layers = snapshot.layers.filter(l => l.type === 'vector');
    const source = new MemoryDataSource([snapshot]);
    const container = document.createElement('div'); container.style.cssText = 'position:fixed;left:0;top:0;width:500px;height:400px'; document.body.append(container);
    const canvasCount = document.querySelectorAll('canvas').length;
    for (let i = 0; i < 20; i++) { const e = createMapEngine({ container, dataSource: source }); await e.loadMap('local'); e.destroy(); e.destroy(); }
    const after = document.querySelectorAll('canvas').length;
    const second = createMapEngine({ container, dataSource: source }); await second.loadMap('local'); second.selectEntity('harbor');
    const isolated = window.noxEngine.getState().selectedEntityId === undefined;
    second.destroy(); container.remove(); return { canvasCount, after, isolated };
  });
  expect(result.after).toBe(result.canvasCount); expect(result.isolated).toBe(true);
});
test('keeps navigation keys out of inputs and clears selection with Escape', async ({ page }) => {
  const before = await page.evaluate(() => window.noxEngine.getState().camera);
  await page.locator('#search').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.type('observ');
  expect(await page.evaluate(() => window.noxEngine.getState().camera)).toEqual(before);
  await expect(page.locator('#entities button')).toHaveCount(1); await page.locator('#entities button').click();
  await page.locator('#map').focus(); await page.keyboard.press('Escape'); await expect(page.locator('#details-panel')).toBeHidden();
});
test('mobile touch tap, drag and pinch reach native map interactions', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Uses Chromium CDP touch dispatch');
  const cdp = await page.context().newCDPSession(page);
  const box = (await page.locator('#map').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const before = await page.evaluate(() => window.noxEngine.getState().camera!.zoom);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 25, y: cy, id: 0 }, { x: cx + 25, y: cy, id: 1 }] });
  for (let distance = 30; distance <= 80; distance += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - distance, y: cy, id: 0 }, { x: cx + distance, y: cy, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.noxEngine.getState().camera!.zoom)).toBeGreaterThan(before);
  await page.evaluate(() => window.noxEngine.focusEntity('point'));
  const pixel = await page.evaluate(() => window.noxEngine.mapToScreen([500, 400])!);
  await page.touchscreen.tap(box.x + pixel[0], box.y + pixel[1]); await expect(page.locator('#details h2')).toHaveText('Observatório');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 60, y: cy + 50, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350); expect(await page.evaluate(() => window.noxEngine.getState().selectedEntityId)).toBeUndefined();
});
