import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, extname, join, normalize, resolve } from 'node:path';

const requestedRoot = resolve(process.argv[2] || '.');
const parentRoot = resolve(requestedRoot, '..');
const root = basename(requestedRoot).toLowerCase() === 'html'
  && existsSync(join(parentRoot, 'index.html'))
  && existsSync(join(parentRoot, 'images'))
  ? parentRoot
  : requestedRoot;
const port = Number(process.argv[3] || 8766);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

function filePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const safe = normalize(decoded).replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
  let target = resolve(join(root, safe));
  if (!target.startsWith(root)) target = join(root, 'index.html');
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
  if ((!existsSync(target) || !statSync(target).isFile()) && /^\/course\/[^/]+\/?$/.test(decoded)) {
    target = join(root, 'course', 'index.html');
  }
  return target;
}

createServer((req, res) => {
  const target = filePath(req.url || '/');
  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': types[extname(target).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  createReadStream(target).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});
