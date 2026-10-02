import { build } from 'vite';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const packages = ['core', 'data-source-static', 'renderer-openlayers', 'engine', 'controls', 'cli'];
for (const name of packages) {
  const root = resolve('packages', name);
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  await build({ configFile: false, root, logLevel: 'warn', build: {
    lib: { entry: resolve(root, 'src/index.ts'), formats: ['es'], fileName: () => 'index.js' },
    sourcemap: true, minify: false,
    rolldownOptions: { external: id => Object.keys(pkg.dependencies ?? {}).some(dep => id === dep || id.startsWith(`${dep}/`)) || id.startsWith('node:') }
  } });
  const config = { extends: '../../tsconfig.json', compilerOptions: { paths: {}, noEmit: false, declaration: true, emitDeclarationOnly: true, rootDir: './src', outDir: './dist' }, include: ['src/**/*.ts'], exclude: ['src/**/*.test.ts'] };
  const configPath = resolve(root, 'tsconfig.build.json');
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', configPath], { stdio: 'inherit' });
  if (name === 'engine' || name === 'controls') await copyFile(resolve(root, 'src/style.css'), resolve(root, 'dist/style.css'));
  if (name === 'cli') await writeFile(resolve(root, 'dist/bin.js'), '#!/usr/bin/env node\nimport { run } from "./index.js";\nrun(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });\n');
  console.log(`Built @nox-map/${name}`);
}
await build({ configFile: resolve('apps/standalone/vite.config.ts') });
await build({ configFile: resolve('examples/vite.config.ts') });
