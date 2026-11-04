import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BETA_PRIVACY_VERSION } from '../public/beta-core.js';
import { en } from '../public/translations-en.js';
import vm from 'node:vm';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const pages = (await readdir(root)).filter((file) => file.endsWith('.html'));
const backendOrigin = 'https://naafzrrhjsfaqqrnhrcn.supabase.co';

test('premium updates keep a single real aggregate and distinguish completed, next and future milestones', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const updates = html.match(/<section[^>]+id="updates"[\s\S]*?<\/section>/)?.[0];
  assert.ok(updates);
  assert.equal([...html.matchAll(/data-application-counter\b/g)].length, 1);
  assert.match(updates, /data-count-value data-no-translate>—<\/strong>/);
  assert.doesNotMatch(updates, /3[.,]?712|\d+\s*%|ausverkauft/i);
  assert.match(updates, /aria-current="step"/);
  assert.match(updates, /Voraussichtlich Mitte bis Ende November 2026/);
  for (const match of updates.matchAll(/>([^<>]+)</g)) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (!text || /^[✓↗—]$|^BETA$/.test(text)) continue;
    assert.ok(en[text], `Missing update translation: ${text}`);
  }
});

test('only the cropped star rotates slowly; wordmark stays fixed with a pause and reduced-motion alternative', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const css = await readFile(path.join(root, 'styles.css'), 'utf8');
  assert.match(html, /data-brand-symbol/);
  assert.match(html, /class="brand-wordmark-crop"/);
  assert.match(html, /data-brand-motion-toggle aria-pressed="false"/);
  const spinButton = html.match(/<button\b[^>]*\bdata-brand-spin\b[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(spinButton, 'logo is a native keyboard-operable button');
  assert.match(spinButton, /type="button"/);
  assert.match(spinButton, /aria-label="Novaire-Logo einmal drehen"/);
  assert.match(spinButton, /data-brand-symbol/);
  assert.doesNotMatch(spinButton, /<(?:div|a|input|details)\b|role="img"/, 'button contains only noninteractive phrasing content');
  assert.doesNotMatch(html, /class="brand-light"/);
  assert.match(css, /animation:brand-orbit 180s linear infinite;animation-play-state:paused/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.brand-symbol\{animation:none!important/);
});

async function createLogoHarness({ reducedMotion = false, supportsAnimation = true } = {}) {
  const callbacks = {}, observers = [];
  const animations = [];
  const image = supportsAnimation ? { animate(keyframes, options) {
    const listeners = {};
    const animation = {
      keyframes, options, cancelled: false,
      addEventListener: (event, callback) => { listeners[event] = callback; },
      cancel() { this.cancelled = true; },
      finish() { listeners.finish?.(); },
    };
    animations.push(animation);
    return animation;
  } } : {};
  const symbol = { dataset: {}, querySelector: selector => selector === 'img' ? image : null };
  const toggle = { hidden: true, attributes: {}, addEventListener: (event, callback) => { callbacks.toggle = callback; }, setAttribute(name, value) { this.attributes[name] = value; } };
  const spinButton = { addEventListener: (event, callback) => { callbacks.spin = callback; } };
  const motion = { matches: reducedMotion, addEventListener: (event, callback) => { (callbacks.motion ||= []).push(callback); } };
  const elements = { '[data-brand-symbol]': symbol, '[data-brand-motion-toggle]': toggle, '[data-brand-spin]': spinButton };
  const document = { hidden: false, querySelector: selector => elements[selector] || null, querySelectorAll: () => [], addEventListener: (event, callback) => { (callbacks[event] ||= []).push(callback); } };
  class Observer { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} }
  const source = await readFile(path.join(root, 'app.js'), 'utf8');
  vm.runInNewContext(source, { document, window: { IntersectionObserver: Observer }, IntersectionObserver: Observer, matchMedia: () => motion });
  return {
    symbol, toggle, animations,
    spin: () => callbacks.spin(),
    pause: () => callbacks.toggle(),
    setInView: value => observers[0].callback([{ isIntersecting: value }]),
    setHidden(value) { document.hidden = value; callbacks.visibilitychange.forEach(callback => callback()); },
    setReducedMotion(value) { motion.matches = value; callbacks.motion.forEach(callback => callback({ matches: value })); },
  };
}

test('logo respects manual pause, viewport, background tabs and changing motion preferences', async () => {
  const { symbol, toggle, pause, setInView, setHidden, setReducedMotion } = await createLogoHarness();
  assert.equal(symbol.dataset.motionState, 'running');
  pause();
  assert.equal(symbol.dataset.motionState, 'paused');
  assert.equal(toggle.attributes['aria-pressed'], 'true');
  pause();
  setInView(false);
  assert.equal(symbol.dataset.motionState, 'paused');
  setInView(true);
  assert.equal(symbol.dataset.motionState, 'running');
  setHidden(true);
  assert.equal(symbol.dataset.motionState, 'paused');
  setHidden(false);
  assert.equal(symbol.dataset.motionState, 'running');
  setReducedMotion(true);
  assert.equal(symbol.dataset.motionState, 'paused');
  assert.equal(toggle.hidden, true);
  setReducedMotion(false);
  assert.equal(symbol.dataset.motionState, 'running');
  assert.equal(toggle.hidden, false);
});

test('logo activation makes one quick complete turn without queuing repeated clicks or changing manual pause', async () => {
  const { symbol, toggle, animations, spin, pause } = await createLogoHarness();
  spin();
  spin();
  assert.equal(animations.length, 1, 'a second activation during the turn does not add another');
  assert.deepEqual(Array.from(animations[0].keyframes, frame => frame.transform), ['rotate(0deg)', 'rotate(360deg)']);
  assert.equal(animations[0].options.iterations, 1);
  assert.ok(animations[0].options.duration > 0 && animations[0].options.duration <= 1000, 'requested turn is quick');
  assert.equal(symbol.dataset.motionState, 'running', 'idle rotation is not restarted or paused by activation');
  animations[0].finish();
  pause();
  spin();
  assert.equal(animations.length, 2, 'a completed turn permits another requested turn');
  assert.equal(symbol.dataset.motionState, 'paused', 'an explicit turn does not resume manually paused idle motion');
  assert.equal(toggle.attributes['aria-pressed'], 'true');
  animations[1].finish();
  assert.equal(symbol.dataset.motionState, 'paused');
});

for (const condition of ['Hidden', 'InView', 'ReducedMotion']) {
  test(`logo cancels its requested turn when ${condition} changes and requires a fresh activation after recovery`, async () => {
    const harness = await createLogoHarness();
    const blockedValue = condition !== 'InView';
    harness.spin();
    harness[`set${condition}`](blockedValue);
    assert.equal(harness.animations[0].cancelled, true);
    assert.equal(harness.symbol.dataset.motionState, 'paused');
    harness.spin();
    assert.equal(harness.animations.length, 1, 'blocked motion cannot start a new turn');
    harness[`set${condition}`](!blockedValue);
    assert.equal(harness.animations.length, 1, 'visibility or preference recovery does not start a turn automatically');
    harness.spin();
    assert.equal(harness.animations.length, 2, 'cancellation clears the active turn for the next activation');
  });
}

test('logo does not spin with initial reduced motion or an unavailable animation API', async () => {
  for (const options of [{ reducedMotion: true }, { supportsAnimation: false }]) {
    const harness = await createLogoHarness(options);
    assert.doesNotThrow(() => harness.spin());
    assert.equal(harness.animations.length, 0);
  }
});

test('historical beta result stays separate from the live application counter', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const story = html.match(/<section[^>]+id="geschichte"[\s\S]*?<\/section>/)?.[0];
  assert.ok(story);
  assert.match(story, /<strong class="story-count">3\.712<\/strong>/);
  assert.equal(en['3.712'], '3,712');
  assert.match(story, /Historischer Abschlussstand · 31\. Oktober 2026/);
  assert.doesNotMatch(story, /data-application-counter|data-count-value/);
  assert.equal([...html.matchAll(/3[.,]?712/g)].length, 1, 'historical number appears only once');
});

test('story timeline records the confirmed progression and labels the iOS launch as a target', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const timeline = html.match(/<ol class="story-timeline">([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(timeline);
  assert.deepEqual([...timeline.matchAll(/<time datetime="([^"]+)">/g)].map(match => match[1]), [
    '2025-11-27', '2025-11-28', '2025-12-09', '2026-04-23', '2026-10-10', '2026-10-15', '2026-10-31',
  ]);
  assert.match(timeline, /Unser erster Name: Lenova/);
  assert.match(timeline, /Die Idee des Live Orbs/);
  assert.match(timeline, /Mitte bis Ende November 2026/);
  assert.match(timeline, /der Termin ist noch nicht verbindlich/);
});

test('learning journey replaces the removed learning-report image with an accessible schematic', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /learning-report|lernbericht/i);
  const learningMap = html.match(/<div class="learning-map reveal"[\s\S]*?<p class="diagram-note">([^<]+)<\/p>/)?.[0];
  assert.ok(learningMap);
  assert.equal([...learningMap.matchAll(/<details class="learning-map-step"/g)].length, 4);
  assert.equal([...learningMap.matchAll(/<summary>/g)].length, 4);
  assert.match(learningMap, /Schematischer Lernweg — keine Live-Sitzung/);
});

test('community links expose the intended social accounts and business email with safe external navigation', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const community = html.match(/<section[^>]+id="community"[\s\S]*?<\/section>/)?.[0];
  assert.ok(community);
  const links = [...community.matchAll(/<a href="(https:[^"]+)"([^>]+)>/g)];
  assert.deepEqual(links.map(match => match[1]), [
    'https://www.instagram.com/novaireapp', 'https://www.tiktok.com/@novaireapp', 'https://discord.gg/novaireai',
  ]);
  for (const [, url, attributes] of links) {
    assert.match(attributes, /target="_blank"/, url);
    assert.match(attributes, /rel="noopener noreferrer"/, url);
    assert.match(attributes, /aria-label="[^"]+\(neuer Tab\)"/, url);
  }
  assert.match(community, /href="mailto:armin\.brnicanin@novaireai\.de"/);
  assert.match(community, /Geschäftliche Anfragen &amp; Kooperationen/);
});

test('DACH availability and Android are clearly planned, while growth is a vision without measured claims', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const closing = html.match(/<section[^>]+id="start"[\s\S]*?<\/section>/)?.[0];
  assert.ok(closing);
  assert.match(closing, /Geplant für Deutschland, Österreich und die Schweiz/);
  assert.match(closing, /aria-label="Geplante Länder"/);
  for (const country of ['Deutschland', 'Österreich', 'Schweiz']) assert.ok(closing.includes(country));
  assert.match(closing, /iOS · In Vorbereitung/);
  assert.match(closing, /Android folgt\.<\/span><p>Geplant · Ein Termin steht noch nicht fest\./);
  const growth = html.match(/<figure class="growth-figure reveal"[\s\S]*?<\/figure>/)?.[0];
  assert.ok(growth);
  assert.match(growth, /role="img" aria-labelledby="growth-svg-title growth-svg-desc"/);
  assert.match(growth, /<desc id="growth-svg-desc">[^<]*Keine gemessenen Daten oder Prognose\.<\/desc>/);
  assert.match(growth, /<figcaption id="growth-caption">Schematische Darstellung unserer Vision — keine gemessenen Nutzungszahlen und keine Prognose\.<\/figcaption>/);
});


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
  assert.doesNotMatch(all.join(''), /draft-notice|pending-detail|Arbeitsentwurf|Rechtstexte noch in Prüfung|Vor Veröffentlichung zu klären|\d+[,.]\d{2}\s*€/);
  const imprint = await readFile(path.join(root, 'impressum.html'), 'utf8');
  assert.match(imprint, /Armin Brnicanin/);
  assert.match(imprint, /Hopfenstraße 60/);
  const privacy = await readFile(path.join(root, 'datenschutz.html'), 'utf8');
  assert.match(privacy, /Beta/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /16/);
  assert.match(privacy, /Einwilligung|Zustimmung/);
});
test('confirmed co-founder has a separate imprint section without changing the provider or controller', async () => {
  const imprint = await readFile(path.join(root, 'impressum.html'), 'utf8');
  assert.match(imprint, /<h2>Anbieter<\/h2><address>Armin Brnicanin<br>Novaire<br>Hopfenstraße 60<br>51109 Köln<br>Deutschland<\/address>/);
  assert.match(imprint, /<h2>Co-Founder von Novaire<\/h2><address>Christian Flore<br>Am Gräfenhof 40<br>51109 Köln<br>Deutschland<\/address>/);
  assert.doesNotMatch(imprint, /Gräfenhof 42|Geschäftsführer|Handelsregister|UG\s*\(haftungsbeschränkt\)/);
  assert.equal(en['Co-Founder von Novaire'], 'Co-founder of Novaire');
  for (const filename of ['datenschutz.html', 'agb.html']) {
    const source = await readFile(path.join(root, filename), 'utf8');
    assert.match(source, /Armin Brnicanin/);
    assert.doesNotMatch(source, /Christian Flore|Gräfenhof/);
  }
});
test('privacy lists the four website, beta and mail providers with their actual roles', async () => {
  const privacy = await readFile(path.join(root, 'datenschutz.html'), 'utf8');
  const providerList = privacy.match(/<ul class="privacy-providers">([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(providerList, 'dedicated provider list is present');
  const providers = [...providerList.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
  assert.equal(providers.length, 4, 'only providers used for these website and mail workflows are listed');
  const expected = [
    ['Vercel', 'Website-Hosting', 'https://vercel.com/legal/privacy-notice'],
    ['Supabase', 'Bewerbungen und App-Konten', 'https://supabase.com/privacy'],
    ['IONOS', 'Postfächer und persönliche Antworten', 'https://www.ionos.de/terms-gtc/terms-privacy'],
    ['Resend', 'Automatische Kontomails', 'https://resend.com/legal/privacy-policy'],
  ];
  for (const [index, [name, role, privacyUrl]] of expected.entries()) {
    assert.ok(providers[index].includes(`<h3>${name} <span>${role}</span></h3>`), `${name}: distinct role`);
    assert.ok(providers[index].includes(`href="${privacyUrl}"`), `${name}: direct provider privacy link`);
  }
  assert.doesNotMatch(providerList, /PostHog|Stripe|Google|Vertex AI|Gemini|Versandregion Irland/);
  for (const id of ['beta', 'email', 'dienstleister', 'rechte']) {
    assert.ok(privacy.includes(`id="${id}"`), `stable section anchor: ${id}`);
  }
});
test('privacy explains private Frankfurt beta storage and keeps form submission separate from account mail', async () => {
  const privacy = await readFile(path.join(root, 'datenschutz.html'), 'utf8');
  const beta = privacy.match(/<h2 id="beta">([\s\S]*?)<h2 id="kinder">4\./)?.[1];
  assert.ok(beta, 'beta data flow has its own section');
  assert.match(beta, /verschlüsselt direkt an eine Supabase-Backend-Funktion/);
  assert.match(beta, /privaten Datenbank[\s\S]*?Frankfurt \(eu-central-1\)/);
  assert.match(beta, /Andere Website-Besucher und App-Nutzer können die Bewerbungen nicht abrufen/);
  assert.match(beta, /nicht im öffentlichen Website-Code oder GitHub-Repository gespeichert/);
  assert.match(beta, /weder eine automatische E-Mail noch eine TestFlight-Einladung versendet und kein App-Konto angelegt/);
  assert.match(privacy, /Die vollständige Beta-Bewerbung wird beim Absenden des Formulars nicht an Resend übertragen/);
  assert.match(privacy, /Supabase Auth ausgelöst und über Resend versendet/);
  assert.match(privacy, /Resend ist für diesen Versand zuständig, nicht für unsere IONOS-Postfächer/);
});
test('privacy does not invent active DPAs, EU-only processing or enabled website analytics', async () => {
  const privacy = await readFile(path.join(root, 'datenschutz.html'), 'utf8');
  assert.doesNotMatch(privacy, /(?:Auftragsverarbeitungsverträge|DPAs?)[^<.]{0,160}(?:sind aktiv|aktiviert|alle abgeschlossen)/i);
  assert.match(privacy, /Frankfurt bedeutet nicht, dass sämtliche Daten ausschließlich in Deutschland oder der EU verarbeitet werden/);
  assert.match(privacy, /Verarbeitung außerhalb des Europäischen Wirtschaftsraums/);
  assert.match(privacy, /Wir binden hier weder PostHog noch Vercel Web Analytics oder Werbepixel ein/);
  assert.doesNotMatch(privacy, /(?:PostHog|Vercel Analytics)[^<.]{0,100}(?:starten erst|nachdem du[^<.]*zugestimmt)/i);
  assert.doesNotMatch(privacy, /<script[^>]+src="https?:|googletagmanager|google-analytics|posthog\.com/i);
});
test('privacy retains beta consent, retention and guardian information without silently changing the consent version', async () => {
  const privacy = await readFile(path.join(root, 'datenschutz.html'), 'utf8');
  assert.match(privacy, /Art\. 6 Abs\. 1 lit\. a DSGVO/);
  assert.match(privacy, /Unter 16 muss ein sorgeberechtigtes Elternteil die Bewerbung ausfüllen/);
  assert.match(privacy, /seine eigene Kontakt-E-Mail verwenden/);
  assert.match(privacy, /90 Tage nach Ende der Bewerbungsfrist/);
  assert.match(privacy, /29\. Januar 2027, 00:00 Uhr deutscher Zeit/);
  assert.match(privacy, /nach sieben Tagen zur Löschung fällig/);
  assert.match(privacy, /Widerruf|widerrufen/);
  assert.equal(BETA_PRIVACY_VERSION, '2026-10-beta-v1', 'clarification does not relabel prior consent or break the backend contract');
});
test('updated legal and support copy has the current publication date', async () => {
  for (const filename of ['datenschutz.html', 'impressum.html', 'agb.html', 'support.html']) {
    const source = await readFile(path.join(root, filename), 'utf8');
    const date = source.match(/<p class="updated">Novaire · Stand ([^<]+)<\/p>/)?.[1];
    assert.equal(date, '3. November 2026', filename);
  }
});
test('only the two exact beta endpoints are reachable; no keys or trackers', async () => {
  const names = (await readdir(root)).filter((file) => /\.(?:js|css)$/.test(file));
  const scripts = await Promise.all(names.map((file) => readFile(path.join(root, file), 'utf8')));
  assert.doesNotMatch(scripts.join('\n'), /XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|\beval\s*\(|new Function\s*\(|\b(?:sk-proj-|sk_live_|service_role|SUPABASE_SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(scripts.join('\n'), /@import\s|https?:\/\/fonts\.|google-analytics|googletagmanager|facebook\.net/);
  const app = await readFile(path.join(root,'app.js'),'utf8');
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  const urls = [...scripts.join('\n').matchAll(/https?:\/\/[^\s'"`<>]+/g)].map((match) => match[0]);
  assert.deepEqual([...new Set(urls)].sort(), [`${backendOrigin}/functions/v1/beta-application`, `${backendOrigin}/functions/v1/beta-application/count`].sort());
  const config = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.outputDirectory, 'public');
  const csp = config.headers[0].headers.find((header) => header.key === 'Content-Security-Policy')?.value;
  assert.ok(csp);
  const connect = csp.split(';').map((directive) => directive.trim()).find((directive) => directive.startsWith('connect-src'));
  assert.equal(connect, `connect-src ${backendOrigin}/functions/v1/beta-application ${backendOrigin}/functions/v1/beta-application/count`);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("form-action 'none'"));
  assert.ok(csp.includes("frame-src 'none'"));
});
test('beta application has transparent limits, guardian flow and non-JavaScript fallback', async () => {
  const beta = await readFile(path.join(root, 'beta.html'), 'utf8');
  assert.match(beta, /NOVAIRE BETA · 100 PLÄTZE/);
  assert.match(beta, /Wir wählen 100 passende Tester/);
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
test('expanded beta capacity is consistent across public copy and generated pages', async () => {
  const beta = await readFile(path.join(root, 'beta.html'), 'utf8');
  assert.match(beta, /Wir gestalten Novaire gemeinsam\./);
  assert.match(beta, /<strong>100 Beta-Plätze<\/strong>/);
  for (const filename of ['index.html', 'beta.html', 'agb.html']) {
    const source = await readFile(path.join(root, filename), 'utf8');
    assert.match(source, /100 (?:Beta-Plätze|Plätze|Personen|passende Tester)/, filename);
    assert.doesNotMatch(source, /(?:rund|etwa|ca\.?|mit|wählen)\s+50\s+(?:Plätze|Personen|Tester)/i, filename);
  }
  for (const name of ['description', 'og:description']) {
    const meta = beta.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]+)"`))?.[1];
    assert.match(meta || '', /100/);
  }
});
test('graphics are local and inert, the body font is native and motion optional', async () => {
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
  assert.doesNotMatch(beta, /halloween|pumpkin|seasonal/i);
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
test('Halloween is removed from every page and all executable styles and scripts', async () => {
  for (const name of [...pages, 'styles.css', 'app.js']) {
    const source = await readFile(path.join(root, name), 'utf8');
    assert.doesNotMatch(source, /halloween|seasonal|pumpkin|creepster|scarecrow|🎃|👻/i, name);
  }
  const assets = await readdir(path.join(root, 'assets'));
  assert.ok(assets.every((name) => !/halloween|autumn-pumpkin/i.test(name)));
});
test('expired beta stays closed without reopening the campaign or changing its deadline', async () => {
  const core = await readFile(path.join(root, 'beta-core.js'), 'utf8');
  assert.match(core, /BETA_DEADLINE = Date\.parse\('2026-10-30T23:00:00Z'\)/);
  const beta = await readFile(path.join(root, 'beta.html'), 'utf8');
  assert.match(beta, /data-beta-state="closed"/);
  assert.match(beta, /id="hero-apply-link"[^>]*hidden/);
  assert.match(beta, /Die Bewerbungsrunde ist abgeschlossen/);
  assert.match(beta, /id="beta-form-fields" disabled/);
  const home = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /Die Bewerbungsfrist endete am 30\. Oktober 2026/);
  assert.doesNotMatch(home, /Für die Beta bewerben|Bewirb dich bis/);
  const app = await readFile(path.join(root, 'beta.js'), 'utf8');
  assert.match(app, /document\.body\.dataset\.betaState = closed \? 'closed' : 'open'/);
});
test('parents receive scoped consent, secure transport facts and an actionable deletion guide', async () => {
  const privacy = await readFile(path.join(root, 'datenschutz.html'), 'utf8');
  assert.match(privacy, /3\. November 2026/);
  assert.match(privacy, /Art\. 8/);
  assert.match(privacy, /unter 16/);
  assert.match(privacy, /HTTPS.*TLS|TLS.*HTTPS/);
  assert.match(privacy, /WebRTC/);
  assert.match(privacy, /Frankfurt/);
  const box = privacy.match(/<aside class="privacy-delete-box"[^>]*>([\s\S]*?)<\/aside>/)?.[1];
  assert.ok(box);
  assert.match(box, /Konto &amp; Sicherheit|Konto & Sicherheit/);
  assert.match(box, /Konto löschen/);
  assert.match(box, /support@novaireai\.de/);
  assert.match(box, /Vertretung|sorgeberechtigt|gesetzlich/);
  assert.match(box, /Backups|Sicherungen/);
  assert.doesNotMatch(box, /sofort vollständig|garantiert|ausnahmslos/);
  const css = await readFile(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /\.legal-main \.privacy-delete-box\{[^}]*border:1px solid #4b8dfa[^}]*background:transparent;box-shadow:none/);
});
