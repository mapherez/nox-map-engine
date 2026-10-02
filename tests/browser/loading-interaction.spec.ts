import { test, expect } from '@playwright/test';
import type { MapEngine } from '@nox-map/engine';
declare global { interface Window { noxEngine: MapEngine } }
test('selects a point when a pending base image completes between click and singleclick', async ({ page }, info) => {
  let releaseImage!: () => void;
  const imageGate = new Promise<void>(resolve => { releaseImage = resolve; });
  await page.route('**/maps/local/base.svg', async route => { await imageGate; await route.continue(); });
  await page.goto('/'); await expect(page.locator('#map')).toHaveAttribute('aria-busy', 'false');
  const pixel = await page.evaluate(() => window.noxEngine.mapToScreen([500, 400])!);
  const box = (await page.locator('#map').boundingBox())!;
  const response = page.waitForResponse('**/maps/local/base.svg');
  if (info.project.name === 'mobile-chromium') await page.touchscreen.tap(box.x + pixel[0], box.y + pixel[1]);
  else await page.mouse.click(box.x + pixel[0], box.y + pixel[1]);
  releaseImage(); await response;
  await expect(page.locator('#details h2')).toHaveText('Observatório');
  expect(await page.evaluate(() => window.noxEngine.getState().selectedEntityId)).toBe('point');
});
