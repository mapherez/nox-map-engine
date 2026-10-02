import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({ root, base: './', publicDir: '../apps/standalone/public', server: { port: 5174, strictPort: true },
  resolve: { alias: Object.fromEntries(['core', 'engine', 'renderer-openlayers', 'data-source-static', 'controls'].map(name => [`@nox-map/${name}`, fileURLToPath(new URL(`../packages/${name}/src/index.ts`, import.meta.url))])) },
  build: { outDir: 'dist', rolldownOptions: { input: Object.fromEntries(['web', 'react', 'webview'].map(name => [name, `${root}/${name}/index.html`])) } }
});
