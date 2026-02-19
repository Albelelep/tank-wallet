import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const port = Number.parseInt(process.env.TANKWALLET_UI_PORT || '4173', 10);
const host = '127.0.0.1';

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const requestPath = req.url === '/' ? '/ui/index.html' : req.url;
  const fullPath = path.join(root, requestPath.replace(/\?.*$/, ''));
  const normalized = path.normalize(fullPath);
  if (!normalized.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (!fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }

  const ext = path.extname(normalized).toLowerCase();
  const mime = mimeByExt[ext] || 'application/octet-stream';
  const body = fs.readFileSync(normalized);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(body);
});

server.listen(port, host, () => {
  console.log(`[tank-wallet] UI server at http://${host}:${port}/ui/index.html`);
});
