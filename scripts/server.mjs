import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Serve only public game assets; never expose Git metadata or local files.
    if (!['/', '/index.html', '/style.css', '/favicon.svg'].includes(pathname) && !/^\/src\/[a-zA-Z0-9_-]+\.js$/.test(pathname)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const filename = await realpath(path.join(root, pathname === '/' ? 'index.html' : pathname));
    if (!filename.startsWith(root)) { response.writeHead(403); response.end(); return; }
    const info = await stat(filename);
    if (!info.isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filename).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => { console.error(`Server error: ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => console.log(`LUMEN is running at http://${host}:${port} — Ctrl+C to stop`));
