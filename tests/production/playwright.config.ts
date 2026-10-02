import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({ testDir: '.', testMatch: '*.spec.ts', workers: 1, outputDir: fileURLToPath(new URL('../../test-results/production', import.meta.url)), use: { baseURL: 'http://127.0.0.1:5175' },
  webServer: { command: 'node scripts/serve-built.mjs', cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:5175/atlas/', reuseExistingServer: !process.env.CI },
  projects: [{ name: 'built-chromium', use: { browserName: 'chromium' } }]
});
