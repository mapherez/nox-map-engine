import { test, expect } from '@playwright/test';
import type { MapEngine } from '@nox-map/engine';
declare global { interface Window { noxEngine: MapEngine } }
test('unlabelled singleton clusters retain each point geometry', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-title')).toHaveText('Costa de Esmeralda');
  const results = await page.evaluate(async () => {
    const engine = window.noxEngine;
    engine.upsertEntities([
      { id: 'singleton-a', layerId: 'points', geometry: { type: 'Point', coordinates: [100, 400] }, style: { labelMinZoom: 10 } },
      { id: 'singleton-b', layerId: 'points', geometry: { type: 'Point', coordinates: [700, 400] }, style: { labelMinZoom: 10 } }
    ]);
    engine.fitBounds();
    await new Promise(requestAnimationFrame);
    return [[100, 400], [700, 400]].map(p => engine.pick(engine.mapToScreen(p as [number, number])!).flatMap(h => h.entityIds));
  });
  expect(results[0]).toContain('singleton-a'); expect(results[1]).toContain('singleton-b');
});
test('hiding or removing a hovered entity disposes its tooltip', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'Touch does not expose hover');
  await page.goto('/'); await expect(page.locator('#map-title')).toHaveText('Costa de Esmeralda');
  const pixel = await page.evaluate(() => window.noxEngine.mapToScreen([500, 400])!);
  const box = (await page.locator('#map').boundingBox())!;
  await page.mouse.move(box.x + pixel[0], box.y + pixel[1]); await expect(page.locator('.nox-tooltip')).toBeVisible();
  await page.evaluate(() => window.noxEngine.setLayerVisibility('points', false)); await expect(page.locator('.nox-tooltip')).toBeHidden();
  await page.evaluate(() => window.noxEngine.setLayerVisibility('points', true));
  await page.mouse.move(box.x + pixel[0] + 1, box.y + pixel[1]); await expect(page.locator('.nox-tooltip')).toBeVisible();
  await page.evaluate(() => window.noxEngine.removeEntities(['point'])); await expect(page.locator('.nox-tooltip')).toBeHidden();
});
