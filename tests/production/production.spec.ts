import { test, expect } from '@playwright/test';
test('static production viewer opens under a subdirectory and restores links', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/atlas/'); await expect(page.locator('#map-title')).toHaveText('Costa de Esmeralda');
  await page.getByRole('button', { name: 'Observatório', exact: false }).click(); await expect(page.locator('#details h2')).toHaveText('Observatório');
  const url = page.url(); await page.reload(); await expect(page.locator('#details h2')).toHaveText('Observatório'); expect(page.url()).toBe(url);
  expect(errors).toEqual([]);
});
for (const example of ['web', 'react', 'webview']) test(`built ${example} integration mounts a map and selects a point`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/examples/${example}/`); await expect(page.locator('.nox-map canvas').first()).toBeVisible();
  await expect(page.locator('.nox-map')).toHaveAttribute('aria-busy', 'false');
  const box = (await page.locator('.nox-map').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('status')).toContainText(example === 'web' ? '148 m' : 'Observatório');
  if (example === 'webview') {
    await page.evaluate(() => (window as unknown as { noxBridge: { select(id: string): void } }).noxBridge.select('harbor'));
    await expect(page.getByRole('status')).toContainText('Porto de Maré');
  }
  expect(errors).toEqual([]);
});
