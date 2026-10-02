import { it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareMap } from './index.js';
it('prepares a non-square transparent raster, complete levels and a scaled manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nox-map-test-'));
  try {
    const input = join(root, 'input.png'), out = join(root, 'map');
    await sharp({ create: { width: 513, height: 301, channels: 4, background: { r: 10, g: 120, b: 70, alpha: .5 } } }).png().toFile(input);
    const map = await prepareMap({ input, out, mapId: 'prepared', unitsPerPixel: .1, initialView: { center: [20, 15], zoom: 1 } });
    expect(map.bounds).toEqual([0, 0, 51.300000000000004, 30.1]); expect(map.initialView?.center).toEqual([20, 15]);
    const levels = (await readdir(join(out, 'tiles'))).filter(n => /^\d+$/.test(n)); expect(levels).toEqual(['0', '1', '2']);
    // x=2 exists because width is 513; y=2 must not exist because height is 301.
    expect((await sharp(join(out, 'tiles/2/2/0.png')).metadata()).width).toBe(256);
    await expect(readFile(join(out, 'tiles/2/0/2.png'))).rejects.toThrow();
    const manifest = JSON.parse(await readFile(join(out, 'map.json'), 'utf8')); expect(manifest.entitiesUrl).toBe('./entities.json'); expect(manifest.sources[0].maxLevel).toBe(2);
    await expect(prepareMap({ input, out, mapId: 'overwrite' })).rejects.toThrow('already exists');
  } finally { if (resolve(root).startsWith(resolve(tmpdir()))) await rm(root, { recursive: true, force: true }); }
});
it('normalizes EXIF orientation and writes explicit JPEG pyramids', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nox-map-test-'));
  try {
    const input = join(root, 'oriented.jpg'), out = join(root, 'map');
    await sharp({ create: { width: 301, height: 513, channels: 3, background: '#a45730' } }).jpeg().withMetadata({ orientation: 6 }).toFile(input);
    const map = await prepareMap({ input, out, mapId: 'rotated', format: 'jpeg' });
    expect(map.bounds).toEqual([0, 0, 513, 301]); expect(map.sources[0]).toMatchObject({ width: 513, height: 301, template: './tiles/{z}/{x}/{y}.jpg' });
    expect((await sharp(join(out, 'tiles/2/2/0.jpg')).metadata()).format).toBe('jpeg');
    expect((await sharp(join(out, 'thumbnail.png')).metadata()).orientation).toBeUndefined();
  } finally { if (resolve(root).startsWith(resolve(tmpdir()))) await rm(root, { recursive: true, force: true }); }
});
it('rejects invalid configuration without publishing partial output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nox-map-test-'));
  try {
    const input = join(root, 'input.png'), out = join(root, 'map');
    await sharp({ create: { width: 10, height: 10, channels: 4, background: '#00000000' } }).png().toFile(input);
    await expect(prepareMap({ input, out, mapId: 'bad', initialView: { center: [0, 0], zoom: NaN } })).rejects.toThrow();
    await expect(stat(out)).rejects.toThrow(); expect(await readdir(root)).toEqual(['input.png']);
  } finally { if (resolve(root).startsWith(resolve(tmpdir()))) await rm(root, { recursive: true, force: true }); }
});
