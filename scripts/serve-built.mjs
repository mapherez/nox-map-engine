import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const roots = { atlas: resolve('apps/standalone/dist'), examples: resolve('examples/dist') };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
createServer(async (req, res) => {
  try {
    const parts = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).split('/').filter(Boolean);
    const root = roots[parts.shift()]; if (!root) { res.writeHead(404).end(); return; }
    let file = resolve(root, ...parts); if (!extname(file)) file = resolve(file, 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
}).listen(5175, '127.0.0.1', () => console.log('Built apps at http://127.0.0.1:5175/atlas/ and /examples/'));
