import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const pages = (await readdir(root)).filter((file) => file.endsWith('.html'));
const backendOrigin = 'https://naafzrrhjsfaqqrnhrcn.supabase.co';


test('public pages are indexable and have a single production canonical URL', async () => {
  for (const filename of pages) {
    const source = await readFile(path.join(root, filename), 'utf8');
    const head = source.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
    assert.ok(head, filename);
    const robots = [...head.matchAll(/<meta name="robots" content="([^"]+)">/g)];
    assert.equal(robots.length, 1, filename);
    if (filename === '404.html') {
      assert.equal(robots[0][1], 'noindex');
      assert.doesNotMatch(head, /rel="canonical"/);
      continue;
    }
    assert.equal(robots[0][1], 'index, follow', filename);
    assert.doesNotMatch(head, /noindex|nofollow|noarchive/i);
    const canonical = [...head.matchAll(/<link rel="canonical" href="([^"]+)">/g)];
    assert.equal(canonical.length, 1, filename);
    const pathname = filename === 'index.html' ? '/' : '/' + filename.replace(/\.html$/, '');
    assert.equal(canonical[0][1], 'https://www.novaireai.de' + pathname, filename);
    if (filename === 'index.html' || filename === 'beta.html') {
      assert.equal(head.match(/<meta property="og:url" content="([^"]+)">/)?.[1], canonical[0][1]);
    }
  }
});

test('robots and sitemap expose only canonical public pages, never 404 or internal files', async () => {
  const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
  assert.equal(robots, 'User-agent: *\nAllow: /\n\nSitemap: https://www.novaireai.de/sitemap.xml\n');
  const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = pages.filter((filename) => filename !== '404.html')
    .map((filename) => 'https://www.novaireai.de' + (filename === 'index.html' ? '/' : '/' + filename.replace(/\.html$/, '')));
  assert.deepEqual(locations.sort(), expected.sort());
  assert.equal(locations.length, new Set(locations).size);
  assert.doesNotMatch(sitemap, /404|vercel\.app|\.zip|LAUNCH-CHECKLIST|BETA-OPERATIONS|lastmod/);
});

test('Vercel config no longer adds a site-wide indexing ban and keeps safety headers', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.cleanUrls, true);
  assert.equal(config.trailingSlash, false);
  for (const rule of config.headers) {
    for (const header of rule.headers) {
      if (header.key.toLowerCase() === 'x-robots-tag') {
        assert.doesNotMatch(header.value, /\b(?:noindex|nofollow|none)\b/i);
      }
    }
  }
  const headers = config.headers.find((rule) => rule.source === '/(.*)').headers;
  assert.ok(headers.some((header) => header.key === 'X-Content-Type-Options' && header.value === 'nosniff'));
  assert.ok(headers.some((header) => header.key === 'X-Frame-Options' && header.value === 'DENY'));
  assert.ok(headers.some((header) => header.key === 'Content-Security-Policy'));
});

test('seven standalone German HTML pages exist', () => {
  assert.deepEqual(pages.sort(), ['404.html','agb.html','beta.html','datenschutz.html','impressum.html','index.html','support.html']);
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
      const local = new URL(url, `https://www.novaireai.de/${file}`);
      const filename = local.pathname === '/' ? 'index.html' : local.pathname.replace(/^\//, '');
      await access(path.join(root, filename));
      if (local.hash) {
        const target = await readFile(path.join(root, filename), 'utf8');
        assert.match(target, new RegExp(`\\bid="${local.hash.slice(1)}"`), `missing target ${url}`);
      }
    }
    assert.doesNotMatch(source, /<script[^>]+src="https?:/);
    assert.doesNotMatch(source, /(?:sk_live_|sk_test_|service_role|test_yUzK)/);
  });
}
test('public copy has no editorial drafts, unconfirmed operator or invented promises', async () => {
  const all = await Promise.all(pages.map((p)=>readFile(path.join(root,p),'utf8')));
  assert.doesNotMatch(all.join(''), /draft-notice|pending-detail|Arbeitsentwurf|Rechtstexte noch in Prüfung|Vor Veröffentlichung zu klären|Christian Flore|Gräfenhof|\d+[,.]\d{2}\s*€/);
  const imprint = await readFile(path.join(root, 'impressum.html'), 'utf8');
  assert.match(imprint, /Armin Brnicanin/);
  assert.match(imprint, /Hopfenstraße 60/);
  const privacy = await readFile(path.join(root, 'datenschutz.html'), 'utf8');
  assert.match(privacy, /Beta/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /16/);
  assert.match(privacy, /Einwilligung|Zustimmung/);
});
test('one exact beta endpoint is the only external runtime call; no keys or trackers', async () => {
  const names = (await readdir(root)).filter((file) => /\.(?:js|css)$/.test(file));
  const scripts = await Promise.all(names.map((file) => readFile(path.join(root, file), 'utf8')));
  assert.doesNotMatch(scripts.join('\n'), /XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|\beval\s*\(|new Function\s*\(|\b(?:sk-proj-|sk_live_|service_role|SUPABASE_SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(scripts.join('\n'), /@import\s|https?:\/\/fonts\.|google-analytics|googletagmanager|facebook\.net/);
  const app = await readFile(path.join(root,'app.js'),'utf8');
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  const urls = [...scripts.join('\n').matchAll(/https?:\/\/[^\s'"`<>]+/g)].map((match) => match[0]);
  assert.deepEqual([...new Set(urls)], [`${backendOrigin}/functions/v1/beta-application`]);
  const config = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.outputDirectory, 'public');
  const csp = config.headers[0].headers.find((header) => header.key === 'Content-Security-Policy')?.value;
  assert.ok(csp);
  const connect = csp.split(';').map((directive) => directive.trim()).find((directive) => directive.startsWith('connect-src'));
  assert.equal(connect, `connect-src ${backendOrigin}/functions/v1/beta-application`);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("form-action 'none'"));
  assert.ok(csp.includes("frame-src 'none'"));
});
test('beta application has transparent limits, guardian flow and non-JavaScript fallback', async () => {
  const beta = await readFile(path.join(root, 'beta.html'), 'utf8');
  assert.match(beta, /50/);
  assert.match(beta, /30\.\s*Oktober/);
  assert.match(beta, /2026/);
  assert.match(beta, /Überraschung/);
  assert.match(beta, /Eltern|Sorgeberechtigt/);
  assert.match(beta, /<noscript>/);
  assert.match(beta, /mailto:support@novaireai\.de/i);
  assert.match(beta, /<label[^>]+for="[^"]+"/);
  for (const name of ['name', 'age', 'email', 'source', 'sourceDetail', 'motivation', 'device', 'grade', 'availability', 'consent', 'website']) {
    assert.match(beta, new RegExp(`\\bname="${name}"`), `missing form field ${name}`);
  }
  assert.match(beta, /type="email"/);
  assert.match(beta, /min="10"/);
  assert.match(beta, /max="99"/);
  assert.match(beta, /minlength="20"/);
  assert.match(beta, /maxlength="2000"/);
  assert.match(beta, /href="datenschutz\.html#[^"]+"/);
  assert.doesNotMatch(beta, /automatisch angenommen|garantiert(?:e|er)? (?:Platz|Zugang)|unbegrenzte|lebenslang/i);
});
test('seasonal graphics are local and inert, the body font is native and motion optional', async () => {
  const svgNames = (await readdir(path.join(root, 'assets'))).filter((file) => file.endsWith('.svg'));
  for (const filename of svgNames) {
    const svg = await readFile(path.join(root, 'assets', filename), 'utf8');
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i, `active or remote SVG ${filename}`);
  }
  const css = await readFile(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /(?:-apple-system|system-ui)/);
  assert.match(css, /prefers-reduced-motion/);
  for (const [, quoted, unquoted] of css.matchAll(/url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)/g)) {
    const asset = quoted || unquoted;
    assert.doesNotMatch(asset, /^(?:https?:|data:|javascript:|\/\/)/i, 'CSS never loads remote or active resources');
    if (asset.startsWith('#')) continue;
    await access(path.join(root, asset.split(/[?#]/)[0]));
  }
  const beta = await readFile(path.join(root, 'beta.html'), 'utf8');
  assert.match(beta, /class="seasonal-pumpkin[^\"]*"[^>]*alt=""[^>]*aria-hidden="true"/);
});
test('beta motivation is approachable and the receipt never pretends to award a beta place', async () => {
  const beta = await readFile(path.join(root, 'beta.html'), 'utf8');
  const motivation = beta.match(/<p[^>]+id="motivation-hint"[^>]*>([\s\S]*?)<\/p>/)?.[1];
  assert.ok(motivation, 'motivation has a persistent accessible hint');
  const placeholder = beta.match(/<textarea[^>]+id="beta-motivation"[^>]+placeholder="([^"]+)"/)?.[1];
  assert.ok(placeholder, 'the motivation box has an approachable starting prompt');
  assert.match(placeholder, /(?:schreib|rede|sprich)/i);
  assert.match(placeholder, /wir[^.!?]*jung/i);
  assert.match(motivation, /20 Zeichen/);
  assert.match(motivation, /keine sensiblen/i);
  const receipt = beta.match(/<div[^>]+id="beta-success"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(receipt, 'there is an explicit, initially hidden receipt');
  assert.match(receipt, /Bewerbung[^.!?]*(?:angekommen|eingegangen|erhalten)/i);
  assert.match(receipt, /keine Zusage/i);
  assert.doesNotMatch(receipt, /herzlichen gl[üu]ckwunsch|du bist (?:angenommen|dabei)|dein (?:Beta)?platz ist sicher|willkommen (?:in|bei) der beta/i);
  const betaScript = await readFile(path.join(root, 'beta.js'), 'utf8');
  assert.match(betaScript, /response\.status !== 202 \|\| result\?\.accepted !== true/);
});
test('realistic Halloween decoration is local, inert and distributed across both pages', async () => {
  for (const filename of ['index.html','beta.html']) {
    const source = await readFile(path.join(root,filename),'utf8');
    const ornaments = [...source.matchAll(/<img\b[^>]*\bdata-seasonal-decoration\b[^>]*>/g)];
    assert.ok(ornaments.length >= 4, `${filename}: seasonal accents are distributed rather than one pumpkin`);
    for (const match of ornaments) {
      const tag = match[0];
      assert.match(tag, /\balt=""/);
      const priorMarkup = source.slice(0,match.index);
      assert.ok(/\baria-hidden="true"/.test(tag) || /<[^>]+\baria-hidden="true"[^>]*>\s*$/.test(priorMarkup), `${filename}: decoration or its immediate container is hidden from assistive technology`);
      assert.doesNotMatch(tag,/\b(?:tabindex|onclick|onmouseover)=/i);
      assert.match(tag,/\bsrc="assets\/halloween-[^"/]+\.webp"/);
      const assetName = tag.match(/\bsrc="([^"]+)"/)[1];
      const image = await readFile(path.join(root,assetName));
      assert.equal(image.toString('ascii',0,4),'RIFF',`${assetName}: actual WebP container, not a renamed placeholder`);
      assert.equal(image.toString('ascii',8,12),'WEBP',`${assetName}: actual WebP content`);
    }
    assert.match(source,/halloween-[^"/]*vine[^"/]*\.webp/);
    assert.match(source,/halloween-[^"/]*scarecrow[^"/]*\.webp/);
    assert.match(source,/halloween-[^"/]*pumpkin[^"/]*\.webp/);
    assert.doesNotMatch(source,/assets\/(?:autumn-pumpkin|halloween-vine|halloween-scarecrow|halloween-pumpkin-cluster)\.svg/, 'flat placeholder illustrations are no longer displayed');
  }
});
test('subtle star backdrop belongs only to the two seasonal marketing pages', async () => {
  const app = await readFile(path.join(root,'app.js'),'utf8');
  assert.match(app,/if\s*\(document\.body\.classList\.contains\('seasonal-site'\)\)\s*\{/);
  assert.match(app,/stars\.setAttribute\('data-seasonal-stars',\s*''\)/);
  assert.match(app,/stars\.setAttribute\('aria-hidden',\s*'true'\)/);
  assert.match(app,/stars\.setAttribute\('inert',\s*''\)/);
  assert.match(app,/const colors = \[[^\]]*'white'[^\]]*'blue'[^\]]*'yellow'/);
  assert.doesNotMatch(app,/requestAnimationFrame|setInterval/,'star backdrop adds no permanent JavaScript animation loop');
  for (const filename of pages) {
    const source = await readFile(path.join(root,filename),'utf8');
    if (filename === 'index.html' || filename === 'beta.html') {
      assert.match(source,/<body\b[^>]*class="[^\"]*\bseasonal-site\b[^\"]*"/);
    } else {
      assert.doesNotMatch(source,/\b(?:seasonal-site|data-seasonal-stars|data-halloween-caption)\b/, `${filename}: legal and support pages remain undecorated`);
    }
  }
});
test('Halloween caption uses a local licensed display face without moving the application deadline', async () => {
  for (const filename of ['index.html','beta.html']) {
    const source = await readFile(path.join(root,filename),'utf8');
    const captionMarkup = source.match(/<p[^>]+\bdata-halloween-caption\b[^>]*>([\s\S]*?)<\/p>/)?.[1];
    assert.match(captionMarkup || '', /<span class="halloween-celebrate">feiern<\/span>/);
    const caption = captionMarkup?.replace(/<[^>]+>/g, '');
    assert.ok(caption, `${filename}: Halloween caption is present`);
    assert.match(caption,/Endet vor Halloween/);
    assert.match(caption,/damit ihr feiern könnt/);
    assert.doesNotMatch(caption,/endet an halloween/i, '30 October remains before Halloween, not 31 October');
  }
  const core = await readFile(path.join(root,'beta-core.js'),'utf8');
  assert.match(core,/BETA_DEADLINE = Date\.parse\('2026-10-30T23:00:00Z'\)/);
  const css = await readFile(path.join(root,'styles.css'),'utf8');
  assert.match(css,/@font-face\s*\{[^}]*font-family:\s*["'](?:Creepster|Novaire Halloween)["'][^}]*creepster-latin\.woff2[^}]*\}/);
  assert.match(css,/@font-face\s*\{[^}]*font-display:\s*swap/);
  assert.match(css, /\.halloween-deadline\{[^}]*color:#f4a04e/);
  assert.match(css, /\.halloween-celebrate\{color:#b5f54a\}/);
  const fonts = path.join(root,'assets','fonts');
  const names = await readdir(fonts);
  assert.ok(names.some((name) => /creepster[^/]*\.(?:woff2?|ttf)$/i.test(name)), 'display face is bundled locally');
  const licenseName = names.find((name) => /(?:ofl|license)[^/]*\.(?:txt|md)$/i.test(name));
  assert.ok(licenseName, 'bundled display font includes its redistribution license');
  const license = await readFile(path.join(fonts,licenseName),'utf8');
  assert.match(license,/SIL OPEN FONT LICENSE|Apache License/i);
});
