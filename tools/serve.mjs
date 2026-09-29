import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, `.${name === '/' ? '/index.html' : name}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!path.extname(file)) file += '.html';
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
    res.end(await readFile(path.join(root, '404.html')));
  }
}).listen(port, '127.0.0.1', () => console.log(`Novaire preview: http://127.0.0.1:${port}`));
