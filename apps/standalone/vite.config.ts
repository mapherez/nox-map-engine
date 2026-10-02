import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('.', import.meta.url));
const names = ['core', 'engine', 'renderer-openlayers', 'data-source-static', 'controls'];
export default defineConfig({
  root, base: './',
  plugins: [{ name: 'synthetic-benchmark-tiles', configureServer(server) {
    server.middlewares.use('/benchmark/tiles', async (_req, res) => {
      try { res.setHeader('Content-Type', 'image/png'); res.end(await readFile(fileURLToPath(new URL('./public/maps/local/benchmark-tile.png', import.meta.url)))); }
      catch { res.statusCode = 404; res.end(); }
    });
  } }],
  resolve: { alias: Object.fromEntries(names.map(name => [`@nox-map/${name}`, fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))])) },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  build: { outDir: 'dist', sourcemap: true },
});
