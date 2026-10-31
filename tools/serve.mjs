import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8'};

// A single range is sufficient for browser video seeking. Reject malformed,
// multiple or unsatisfiable ranges instead of passing unchecked offsets to fs.
function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  if (!match[1]) {
    const length = Number(match[2]);
    if (!Number.isSafeInteger(length) || length === 0) return null;
    return { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return null;
  return { start, end: Math.min(end, size - 1) };
}

export function createPreviewServer({ publicRoot = root } = {}) {
  const directory = path.resolve(publicRoot);
  return http.createServer(async (req, res) => {
    for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
    try {
      const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(directory, `.${name === '/' ? '/index.html' : name}`);
      if (!file.startsWith(directory + path.sep)) { res.writeHead(403, { 'Content-Length': 0 }).end(); return; }
      if (!path.extname(file)) file += '.html';
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
      const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size, 'Accept-Ranges': 'bytes' };
      let range;
      // HEAD reports the complete representation. Without validators, an
      // If-Range condition cannot be established, so send the complete file.
      if (req.method === 'GET' && req.headers.range && !req.headers['if-range']) {
        range = byteRange(req.headers.range, info.size);
        if (!range) {
          res.writeHead(416, { ...headers, 'Content-Length': 0, 'Content-Range': `bytes */${info.size}` }).end();
          return;
        }
        headers['Content-Length'] = range.end - range.start + 1;
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
      }
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      await pipeline(createReadStream(file, range || undefined), res);
    } catch {
      if (res.headersSent || res.destroyed) { res.destroy(); return; }
      const body = await readFile(path.join(directory, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const server = createPreviewServer();
  server.listen(port, '127.0.0.1', () => console.log(`Novaire preview: http://127.0.0.1:${server.address().port}`));
}
