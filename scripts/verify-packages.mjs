import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const expected = {
  core: ['validateSnapshot', 'parseViewState', 'importGeoJSON'],
  'data-source-static': ['StaticHttpDataSource', 'MemoryDataSource'],
  'renderer-openlayers': ['OpenLayersRenderer'], engine: ['createMapEngine'],
  controls: ['mountControls'], cli: ['prepareMap', 'run']
};
for (const [directory, exports] of Object.entries(expected)) {
  const pkg = JSON.parse(await readFile(`packages/${directory}/package.json`, 'utf8'));
  const module = await import(pkg.name);
  for (const name of exports) assert.equal(typeof module[name], 'function', `${pkg.name} exports ${name}`);
  const [pack] = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run', '--json', `--workspace=${pkg.name}`], { encoding: 'utf8' }));
  const files = new Set(pack.files.map(file => file.path));
  for (const target of Object.values(pkg.exports)) {
    for (const file of typeof target === 'string' ? [target] : Object.values(target)) assert(files.has(file.replace(/^\.\//, '')), `${pkg.name} packages ${file}`);
  }
  for (const bin of Object.values(pkg.bin ?? {})) assert(files.has(bin.replace(/^\.\//, '')), `${pkg.name} packages its CLI`);
  assert(!pack.files.some(file => file.path.includes('/src/') || file.path.includes('.test.')), `${pkg.name} excludes implementation/test sources`);
  console.log(`${pkg.name}: ESM imports, declarations, CSS/bin exports and package contents verified`);
}
