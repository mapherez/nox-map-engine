import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('viewer has labelled controls, landmarks and no serious accessibility violations', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-title')).toHaveText('Emerald Coast');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Share location' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search entities' })).toHaveAttribute('placeholder', 'Search the map…');
  await expect(page.locator('#catalog-status')).toHaveText('2 maps available');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.getByRole('button', { name: 'Observatory', exact: false }).click();
  const selected = await new AxeBuilder({ page }).analyze();
  expect(selected.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
