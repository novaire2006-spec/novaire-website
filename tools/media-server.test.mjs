import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPreviewServer } from './serve.mjs';

test('preview serves local media with safe byte ranges and body-free HEAD responses', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'novaire-media-server-'));
  const publicRoot = path.join(fixture, 'public');
  await mkdir(path.join(publicRoot, 'assets'), { recursive: true });
  const media = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
  const missingPage = '<h1>Nicht gefunden</h1>';
  await Promise.all([
    writeFile(path.join(publicRoot, 'index.html'), '<h1>Start</h1>'),
    writeFile(path.join(publicRoot, 'beta.html'), '<h1>Beta</h1>'),
    writeFile(path.join(publicRoot, '404.html'), missingPage),
    writeFile(path.join(fixture, 'private.txt'), 'outside the public directory'),
    ...['demo.mp4', 'demo.webm', 'demo.vtt', 'poster.jpg', 'poster.jpeg'].map((name) => writeFile(path.join(publicRoot, 'assets', name), media)),
    writeFile(path.join(publicRoot, 'assets', 'empty.mp4'), ''),
  ]);
  const server = createPreviewServer({ publicRoot });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(fixture, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  function request(url = '/assets/demo.mp4', { method = 'GET', headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: url, method, headers }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  await t.test('complete media advertises its MIME type, length and seeking support', async () => {
    for (const [filename, type] of [['demo.mp4', 'video/mp4'], ['demo.webm', 'video/webm'], ['demo.vtt', 'text/vtt; charset=utf-8'], ['poster.jpg', 'image/jpeg'], ['poster.jpeg', 'image/jpeg']]) {
      const response = await request(`/assets/${filename}`);
      assert.equal(response.status, 200, filename);
      assert.equal(response.headers['content-type'], type, filename);
      assert.equal(response.headers['content-length'], String(media.length), filename);
      assert.equal(response.headers['accept-ranges'], 'bytes');
      assert.equal(response.headers['content-range'], undefined);
      assert.deepEqual(response.body, media);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.match(response.headers['content-security-policy'], /media-src 'self'/);
    }
  });

  await t.test('bounded, open-ended and suffix ranges return only the requested bytes', async () => {
    for (const [range, start, end] of [['bytes=3-8', 3, 8], ['bytes=10-', 10, 35], ['bytes=-5', 31, 35], ['bytes=30-100', 30, 35], ['bytes=-100', 0, 35], ['bytes=0-0', 0, 0]]) {
      const response = await request(undefined, { headers: { Range: range } });
      assert.equal(response.status, 206, range);
      assert.equal(response.headers['content-range'], `bytes ${start}-${end}/${media.length}`, range);
      assert.equal(response.headers['content-length'], String(end - start + 1), range);
      assert.deepEqual(response.body, media.subarray(start, end + 1), range);
    }
  });

  await t.test('invalid, unsafe, multiple and unsatisfiable ranges are rejected without a body', async () => {
    for (const range of ['bytes=36-', 'bytes=8-3', 'bytes=-0', 'bytes=-', 'bytes=abc-def', 'bytes=0-2,4-6', 'bytes=9007199254740992-', 'bytes=-9007199254740992', 'items=0-5']) {
      const response = await request(undefined, { headers: { Range: range } });
      assert.equal(response.status, 416, range);
      assert.equal(response.headers['content-range'], `bytes */${media.length}`, range);
      assert.equal(response.headers['content-length'], '0', range);
      assert.equal(response.body.length, 0, range);
    }
    const empty = await request('/assets/empty.mp4', { headers: { Range: 'bytes=0-' } });
    assert.equal(empty.status, 416);
    assert.equal(empty.headers['content-range'], 'bytes */0');
    assert.equal(empty.body.length, 0);
  });

  await t.test('HEAD ignores ranges and reports full lengths without transferring content', async () => {
    for (const range of [undefined, 'bytes=3-8', 'bytes=999-']) {
      const response = await request(undefined, { method: 'HEAD', headers: range ? { Range: range } : {} });
      assert.equal(response.status, 200);
      assert.equal(response.headers['content-type'], 'video/mp4');
      assert.equal(response.headers['content-length'], String(media.length));
      assert.equal(response.headers['content-range'], undefined);
      assert.equal(response.body.length, 0);
    }
    const missing = await request('/missing', { method: 'HEAD' });
    assert.equal(missing.status, 404);
    assert.equal(missing.headers['content-length'], String(Buffer.byteLength(missingPage)));
    assert.equal(missing.body.length, 0);
  });

  await t.test('unverifiable If-Range requests receive the complete representation', async () => {
    const response = await request(undefined, { headers: { Range: 'bytes=3-8', 'If-Range': '"old-version"' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-range'], undefined);
    assert.deepEqual(response.body, media);
  });

  await t.test('existing routes, 404 fallback and traversal protection remain intact', async () => {
    assert.equal((await request('/')).body.toString(), '<h1>Start</h1>');
    assert.equal((await request('/beta?lang=en')).body.toString(), '<h1>Beta</h1>');
    const missing = await request('/missing');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.toString(), missingPage);
    for (const url of ['/%2e%2e%2fprivate.txt', '/assets/%2e%2e%2f%2e%2e%2fprivate.txt']) {
      const response = await request(url);
      assert.equal(response.status, 403, url);
      assert.equal(response.body.length, 0);
      assert.equal(response.headers['content-length'], '0');
      assert.equal(response.headers['x-frame-options'], 'DENY');
    }
  });
});
