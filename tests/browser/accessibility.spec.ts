import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('viewer has labelled controls, landmarks and no serious accessibility violations', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-title')).toHaveText('Costa de Esmeralda');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.getByRole('button', { name: 'Observatório', exact: false }).click();
  const selected = await new AxeBuilder({ page }).analyze();
  expect(selected.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
