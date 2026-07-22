import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8766);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
  const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let target = resolve(join(root, safe));
  if (!target.startsWith(root)) target = join(root, 'index.html');
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
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
    'Content-Type': types[extname(target).toLowerCase()] || 'application/octet-stream'
  });
  createReadStream(target).pipe(res);
}).listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/ (also reachable from your phone via your computer's local IP, e.g. http://192.168.x.x:${port}/)`);
});
