import { test, expect } from '@playwright/test';
import type { MapEngine } from '@nox-map/engine';
declare global { interface Window { noxEngine: MapEngine } }
test('protected raster and icon assets use the authenticated provider', async ({ page }) => {
  const requests: string[] = [];
  await page.goto('/'); await expect(page.locator('#map-title')).toHaveText('Costa de Esmeralda');
  const snapshot = await page.evaluate(() => ({ ...window.noxEngine.getMap(), entities: window.noxEngine.getEntities() }));
  snapshot.mapId = 'protected';
  const image = snapshot.sources[0]; if (image.type !== 'image') throw new Error('Expected image fixture'); image.asset = { uri: './image.svg' };
  snapshot.entities[0].style = { icon: { uri: './icon.svg' } };
  await page.route('**/secure/**', async route => {
    requests.push(new URL(route.request().url()).pathname);
    if (route.request().headers().authorization !== 'Bearer test-only') { await route.fulfill({ status: 401 }); return; }
    if (route.request().url().endsWith('/catalog.json')) await route.fulfill({ json: { maps: [{ mapId: 'protected', title: 'Protected', currentSnapshotId: 'base', snapshots: { base: './map.json' } }] } });
    else if (route.request().url().endsWith('/map.json')) await route.fulfill({ json: snapshot });
    else if (route.request().url().endsWith('/image.svg')) await route.fulfill({ contentType: 'image/svg+xml', path: 'apps/standalone/public/maps/local/base.svg' });
    else await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="gold"/></svg>' });
  });
  await page.evaluate(async () => {
    const path = '/src/testing.ts', { createMapEngine, StaticHttpDataSource } = await import(path);
    const container = document.createElement('div'); container.id = 'protected-map'; container.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:600px'; document.body.append(container);
    const provider = new StaticHttpDataSource({ catalogUrl: '/secure/catalog.json', request: (url: string, signal: AbortSignal) => fetch(url, { signal, headers: { Authorization: 'Bearer test-only' } }) });
    const e = createMapEngine({ container, dataSource: provider }); await e.loadMap('protected');
    (window as unknown as { protectedEngine: MapEngine }).protectedEngine = e;
  });
  await expect.poll(() => requests).toContain('/secure/image.svg'); await expect.poll(() => requests).toContain('/secure/icon.svg');
  await page.evaluate(() => { (window as unknown as { protectedEngine: MapEngine }).protectedEngine.destroy(); document.getElementById('protected-map')!.remove(); });
});
