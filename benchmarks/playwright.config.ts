import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'performance.spec.ts', workers: 1, timeout: 120000, outputDir: '../test-results/benchmark',
  use: { baseURL: 'http://127.0.0.1:5193' }, reporter: [['list']],
  webServer: { command: 'npm run dev -- --port 5193', url: 'http://127.0.0.1:5193', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-emulated', use: { ...devices['Pixel 7'] } }
  ]
});
