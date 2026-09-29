import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const pages = (await readdir(root)).filter((file) => file.endsWith('.html'));
test('six standalone German HTML pages exist', () => {
  assert.deepEqual(pages.sort(), ['404.html','agb.html','datenschutz.html','impressum.html','index.html','support.html']);
});
for (const file of pages) {
  test(`${file}: local references resolve, language and headings exist`, async () => {
    const source = await readFile(path.join(root,file),'utf8');
    assert.match(source, /<html lang="de">/);
    assert.equal((source.match(/<h1[ >]/g) || []).length, 1);
    assert.match(source, /name="viewport"/);
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'duplicate IDs');
    for (const [,url] of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:)/.test(url)) continue;
      if (url.startsWith('#')) { assert.ok(ids.includes(url.slice(1)),`missing anchor ${url}`); continue; }
      await access(path.join(root, url === '/' ? 'index.html' : url.replace(/^\//,'')));
    }
    assert.doesNotMatch(source, /<script[^>]+src="https?:/);
    assert.doesNotMatch(source, /(?:sk_live_|sk_test_|service_role|test_yUzK)/);
  });
}
test('legal drafts remain explicit; no friend address or fake prices', async () => {
  for (const slug of ['impressum','datenschutz','agb']) {
    const page = await readFile(path.join(root,`${slug}.html`),'utf8');
    assert.match(page, /draft-notice/);
    assert.match(page, /Entwurf|Arbeitsentwurf/);
  }
  const all = await Promise.all(pages.map((p)=>readFile(path.join(root,p),'utf8')));
  assert.doesNotMatch(all.join(''), /Christian Flore|Gräfenhof|\d+[,.]\d{2}\s*€/);
});
test('no trackers, storage or external runtime calls', async () => {
  const js = await readFile(path.join(root,'app.js'),'utf8');
  assert.doesNotMatch(js, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document.cookie|eval\(/);
  const config = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.outputDirectory, 'public');
  assert.ok(config.headers[0].headers.some((h)=>h.key === 'Content-Security-Policy' && h.value.includes("connect-src 'none'")));
});
