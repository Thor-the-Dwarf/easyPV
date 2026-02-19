import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function resolvePath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = safePath === '/' ? '/index.html' : safePath;
  const absolutePath = path.join(ROOT_DIR, candidate);
  const normalized = path.normalize(absolutePath);

  if (!normalized.startsWith(ROOT_DIR)) {
    return null;
  }

  return normalized;
}

async function serveFile(filePath, response) {
  try {
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      return serveFile(path.join(filePath, 'index.html'), response);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);

    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  const filePath = resolvePath(request.url || '/');

  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  await serveFile(filePath, response);
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
