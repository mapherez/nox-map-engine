import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const names = ['core', 'engine', 'renderer-openlayers', 'data-source-static', 'controls'];
export default defineConfig({
  resolve: { alias: Object.fromEntries(names.map(name => [`@nox-map/${name}`, fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))])) },
  test: { include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'], testTimeout: 30000 }
});
