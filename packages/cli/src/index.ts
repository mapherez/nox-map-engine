import sharp from 'sharp';
import { mkdir, mkdtemp, writeFile, rename, readdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname, join, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { validateSnapshot, type Camera, type MapSnapshot, type Position } from '@nox-map/core';
export interface PrepareOptions {
  input: string; out: string; mapId: string; snapshotId?: string; title?: string;
  unitsPerPixel?: number; origin?: Position; initialView?: Camera; format?: 'png' | 'jpeg';
}
export async function prepareMap(options: PrepareOptions): Promise<MapSnapshot> {
  const input = resolve(options.input), out = resolve(options.out);
  const scale = options.unitsPerPixel ?? 1, origin = options.origin ?? [0, 0];
  if (!Number.isFinite(scale) || scale <= 0 || origin.some(n => !Number.isFinite(n))) throw new Error('Invalid unitsPerPixel or origin');
  if (!options.mapId?.trim()) throw new Error('mapId is required');
  if (await stat(out).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) throw new Error('Output already exists; choose a new directory');
  const metadata = await sharp(input, { limitInputPixels: 2_500_000_000 }).metadata();
  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error('Expected a single raster image');
  const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
  const width = rotated ? metadata.height : metadata.width, height = rotated ? metadata.width : metadata.height;
  const snapshot: MapSnapshot = validateSnapshot({
    schemaVersion: 1, mapId: options.mapId, snapshotId: options.snapshotId ?? 'base', title: options.title ?? options.mapId,
    coordinateSystem: { kind: 'local', units: 'map-unit' },
    bounds: [origin[0], origin[1], origin[0] + width * scale, origin[1] + height * scale], initialView: options.initialView,
    sources: [{ id: 'base', type: 'raster-pyramid', template: `./tiles/{z}/{x}/{y}.${options.format === 'jpeg' ? 'jpg' : 'png'}`, tileSize: 256, width, height, unitsPerPixel: scale, origin, maxLevel: Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / 256))) }],
    layers: [{ id: 'base', title: 'Base map', type: 'raster', sourceId: 'base', order: 0, visible: true, opacity: 1 }, { id: 'entities', title: 'Entities', type: 'vector', cluster: { distance: 40 }, order: 1, visible: true, opacity: 1 }], entities: []
  });
  await mkdir(dirname(out), { recursive: true });
  const temporary = await mkdtemp(join(dirname(out), '.prepare-'));
  try {
    const pipeline = sharp(input, { limitInputPixels: 2_500_000_000 }).autoOrient();
    const formatted = options.format === 'jpeg' ? pipeline.jpeg({ quality: 90 }) : pipeline.png();
    const generated = join(temporary, 'tiles-generated');
    await formatted.tile({ layout: 'google', size: 256, overlap: 0, depth: 'onetile', centre: false, skipBlanks: -1, background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(generated);
    await sharp(input, { limitInputPixels: 2_500_000_000 }).autoOrient().resize({ width: 480, height: 320, fit: 'inside', withoutEnlargement: true }).png().toFile(join(temporary, 'thumbnail.png'));
    // Inspect generated levels instead of relying on a decoder's rounding convention.
    const levels = (await readdir(generated)).filter(n => /^\d+$/.test(n)).map(Number);
    if (!levels.length) throw new Error('Tile generator produced no pyramid');
    // libvips google layout is z/y/x; the public engine format is z/x/y.
    for (const level of levels) {
      for (const y of (await readdir(join(generated, String(level)))).filter(n => /^\d+$/.test(n))) {
        for (const file of await readdir(join(generated, String(level), y))) {
          const match = /^(\d+)\.(png|jpg)$/.exec(file); if (!match) continue;
          const destination = join(temporary, 'tiles', String(level), match[1]);
          await mkdir(destination, { recursive: true });
          await rename(join(generated, String(level), y, file), join(destination, `${y}.${match[2]}`));
        }
      }
    }
    if (dirname(generated) === temporary && basename(generated) === 'tiles-generated') await rm(generated, { recursive: true, force: true });
    (snapshot.sources[0] as Extract<MapSnapshot['sources'][number], { type: 'raster-pyramid' }>).maxLevel = Math.max(...levels);
    await writeFile(join(temporary, 'entities.json'), '[]\n');
    const { entities: _, ...manifest } = snapshot;
    await writeFile(join(temporary, 'map.json'), JSON.stringify({ ...manifest, entitiesUrl: './entities.json' }, null, 2) + '\n');
    await writeFile(join(temporary, 'catalog.json'), JSON.stringify({ maps: [{ mapId: snapshot.mapId, title: snapshot.title, thumbnail: { uri: './thumbnail.png' }, currentSnapshotId: snapshot.snapshotId, snapshots: { [snapshot.snapshotId]: './map.json' } }] }, null, 2) + '\n');
    await rename(temporary, out); return snapshot;
  } catch (error) {
    // This path is created by mkdtemp, and must remain inside the checked output parent.
    if (dirname(temporary) === dirname(out) && basename(temporary).startsWith('.prepare-')) await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
export async function run(args: string[]): Promise<void> {
  if (!args.length || args.includes('--help')) {
    console.log('nox-map prepare <image> --out <new-directory> --map-id <id> [--units-per-pixel 1] [--snapshot-id base] [--title Title] [--format png|jpeg] [--center-x X --center-y Y --zoom Z]'); return;
  }
  if (args[0] !== 'prepare') throw new Error('Expected command: prepare');
  const { values, positionals } = parseArgs({ args: args.slice(1), allowPositionals: true, options: {
    out: { type: 'string' }, 'map-id': { type: 'string' }, 'snapshot-id': { type: 'string' }, title: { type: 'string' },
    'units-per-pixel': { type: 'string' }, format: { type: 'string' }, 'center-x': { type: 'string' }, 'center-y': { type: 'string' }, zoom: { type: 'string' }
  } });
  if (positionals.length !== 1 || !values.out || !values['map-id']) throw new Error('Provide one input image, --out and --map-id');
  if (values.format && !['png', 'jpeg'].includes(values.format)) throw new Error('Format must be png or jpeg');
  const hasView = [values['center-x'], values['center-y'], values.zoom].filter(v => v !== undefined).length;
  if (hasView && hasView !== 3) throw new Error('Initial viewport requires --center-x, --center-y and --zoom');
  const snapshot = await prepareMap({ input: positionals[0], out: values.out, mapId: values['map-id'], snapshotId: values['snapshot-id'], title: values.title, unitsPerPixel: values['units-per-pixel'] === undefined ? undefined : Number(values['units-per-pixel']), format: values.format as 'png' | 'jpeg' | undefined, initialView: hasView ? { center: [Number(values['center-x']), Number(values['center-y'])], zoom: Number(values.zoom) } : undefined });
  console.log(`Prepared ${snapshot.mapId}/${snapshot.snapshotId} in ${resolve(values.out)}`);
}
