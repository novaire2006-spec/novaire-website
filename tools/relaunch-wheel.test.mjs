import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { en } from '../public/translations-en.js';

const root = new URL('../public/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('feature-wheel.css', root), 'utf8').catch(() => '');
const js = await readFile(new URL('feature-wheel.js', root), 'utf8').catch(() => '');
const wheel = await import('../public/feature-wheel.js').catch(() => ({}));

// The final copy from the plan, in order.
const features = [
  ['chat', 'Nova Chat', 'Frag nach, bis du es verstanden hast.'],
  ['live', 'Nova Live', 'Sprich mit Nova und sieh die Erklärung entstehen.', 'assets/app-nova-live.png'],
  ['lernplan', 'Lernplan', 'Tag für Tag bis zur Prüfung.'],
  ['deepfokus', 'Deep Fokus', 'Ein Thema am Stück, aus deinem Material.'],
  ['karteikarten', 'Karteikarten', 'Abfragen und wiederholen.', 'assets/app-flashcards.png'],
  ['vokabeln', 'Vokabeln', 'Abfragen, auch vom Foto.'],
  ['merksaetze', 'Merksätze', 'Eselsbrücken, die hängen bleiben.'],
  ['formeln', 'Formelsammlung', 'Nachschlagen und verstehen.'],
  ['gedaechtnis', 'Lerngedächtnis', 'Was schon sitzt und was noch nicht.'],
  ['lernzettel', 'Lernzettel', 'Neu aus Foto, Datei oder Thema.'],
  ['notizen', 'Notizen', 'Deine Notizen an einem Ort.'],
  ['unterlagen', 'Unterlagen', 'Deine Dateien als Grundlage fürs Lernen.'],
  ['skript', 'Skript', 'Lange PDFs bis 60 Seiten zusammenfassen.'],
  ['probeklausur', 'Probeklausur', 'Eine Klausur zum Üben erstellen.'],
  ['muendlich', 'Mündliche Prüfung', 'Das Prüfungsgespräch mit Nova üben.'],
  ['kalender', 'Prüfungskalender', 'Alle Prüfungstermine im Blick.'],
  ['praesentationen', 'Präsentationen', 'Folien fürs Referat erstellen.'],
  ['podcasts', 'Podcasts', 'Nova und Leo erklären zum Hören.', 'assets/app-podcast.png'],
  ['schrift', 'Deine Schrift', 'Texte in deiner eigenen Handschrift.'],
  ['coding', 'Coding', 'Programmieren lernen, Schritt für Schritt.', 'assets/app-coding.png'],
  ['wort', 'Wort des Tages', 'Ein Wort am Tag, eine kleine Pause.'],
  ['community', 'Community', 'Lernzettel anderer entdecken und teilen.'],
  ['nachrichten', 'Nachrichten', 'Privat mit Freunden schreiben.'],
  ['freunde', 'Freunde', 'Freunde finden und einladen.'],
];

const section = html.match(/<section\b[^>]*\bid="features"[\s\S]*?<\/section>/)?.[0] ?? '';
const between = (source, open, close) => {
  const start = source.indexOf(open);
  return start < 0 ? '' : source.slice(start, source.indexOf(close, start) + close.length);
};

// ---------- maths ----------

test('wheelLayout keeps the selected row flat, sharp and fully visible', () => {
  assert.equal(typeof wheel.wheelLayout, 'function');
  assert.deepEqual(wheel.wheelLayout(0, { rowHeight: 60 }), { x: 0, y: 0, rotate: 0, opacity: 1, blur: 0 });
});

test('wheelLayout bends rows two away down the arc, to the left, faded and blurred', () => {
  const below = wheel.wheelLayout(2, { rowHeight: 60 });
  const above = wheel.wheelLayout(-2, { rowHeight: 60 });
  assert.ok(below.y > 0 && below.x < 0);
  assert.equal(below.opacity, 0.5);
  assert.equal(below.blur, 4);
  assert.equal(above.y, -below.y);
  assert.equal(above.x, below.x);
  assert.equal(above.rotate, -below.rotate);
  // The component's maths: R = rowHeight / tilt, y = R·sin(2·tilt), rotate = 2·6°.
  const tilt = 6 * Math.PI / 180;
  assert.ok(Math.abs(below.y - (60 / tilt) * Math.sin(2 * tilt)) < 1e-9);
  assert.ok(Math.abs(below.x + (60 / tilt) * (1 - Math.cos(2 * tilt))) < 1e-9);
  assert.ok(Math.abs(below.rotate - 12) < 1e-9);
  // One row away sits about one row height lower.
  assert.ok(Math.abs(wheel.wheelLayout(1, { rowHeight: 60 }).y - 60) < 0.2);
});

test('wheelLayout never fades below the floor and stops the angle at a quarter turn', () => {
  for (let d = -30; d <= 30; d += 0.25) {
    const row = wheel.wheelLayout(d, { rowHeight: 40 });
    assert.ok(row.opacity >= 0.05, `opacity at ${d}`);
    assert.ok(Math.abs(row.rotate) <= 90 + 1e-9, `rotate at ${d}`);
    for (const value of Object.values(row)) assert.ok(Number.isFinite(value));
  }
  assert.equal(wheel.wheelLayout(10, { rowHeight: 40 }).opacity, 0.05);
  assert.equal(wheel.wheelLayout(1, { rowHeight: 40, fade: 0.5, blur: 3 }).opacity, 0.5);
  assert.equal(wheel.wheelLayout(1, { rowHeight: 40, fade: 0.5, blur: 3 }).blur, 3);
});

test('wheelPosition maps page progress onto the 24 features and clamps outside the track', () => {
  assert.equal(typeof wheel.wheelPosition, 'function');
  assert.equal(wheel.wheelPosition(0, 24), 0);
  assert.equal(wheel.wheelPosition(1, 24), 23);
  assert.equal(wheel.wheelPosition(-0.4, 24), 0);
  assert.equal(wheel.wheelPosition(1.7, 24), 23);
  assert.equal(wheel.wheelPosition(Number.NaN, 24), 0);
  assert.equal(wheel.wheelPosition(0.5, 1), 0);
  let previous = -1;
  for (let p = 0; p <= 1.0000001; p += 0.001) {
    const position = wheel.wheelPosition(p, 24);
    assert.ok(position >= previous - 1e-12, `monotonic at ${p}`);
    assert.ok(position >= 0 && position <= 23);
    previous = position;
  }
});

test('every feature gets the same share of the track and rests centred at its own progress', () => {
  for (let index = 0; index < 24; index += 1) {
    const at = wheel.wheelProgressFor(index, 24);
    assert.ok(Math.abs(at - (index + 0.5) / 24) < 1e-12);
    assert.equal(wheel.wheelPosition(at, 24), index);
    // A short rest around each feature, so the wheel steps rather than drifts.
    assert.equal(wheel.wheelPosition(at + 0.2 / 24, 24), index);
    assert.equal(wheel.wheelPosition(Math.max(0, at - 0.2 / 24), 24), index);
  }
});

test('smoothing follows the component: 200 ms time constant, frame time capped at 50 ms', () => {
  assert.ok(Math.abs(wheel.wheelSmoothing(16) - (1 - Math.exp(-0.016 / 0.2))) < 1e-12);
  assert.equal(wheel.wheelSmoothing(500), wheel.wheelSmoothing(50));
  assert.equal(wheel.wheelSmoothing(0), 0);
});

test('colour mixes from #a6a6a6 to white by closeness, like color-mix in srgb', () => {
  assert.equal(wheel.wheelColor(0), 'rgb(255, 255, 255)');
  assert.equal(wheel.wheelColor(1), 'rgb(166, 166, 166)');
  assert.equal(wheel.wheelColor(-3), 'rgb(166, 166, 166)');
  assert.equal(wheel.wheelColor(0.5), 'rgb(211, 211, 211)');
});

// ---------- markup ----------

test('the product gallery is replaced by the feature wheel section', () => {
  assert.ok(section, 'section #features exists');
  const open = section.match(/^<section\b[^>]*>/)[0];
  assert.match(open, /class="section feature-wheel-section"/);
  assert.match(open, /aria-labelledby="features-title"/);
  assert.match(open, /\bdata-flow-still\b/);
  assert.match(section, /<h2 id="features-title">Deine Features,<br><span class="muted">um besser zu werden\.<\/span><\/h2>/);
  assert.doesNotMatch(html, /feature-tabs|feature-panel|product-section|id="product-title"/);
  assert.equal((html.match(/id="features"/g) ?? []).length, 1);
  // The heading sits above the track, not inside the sticky stage.
  assert.ok(section.indexOf('features-title') < section.indexOf('class="wheel-track"'));
  assert.match(section, /<div class="wheel-track">\s*<div class="wheel-stage">/);
});

test('24 wheel items and 24 details share the plan order and copy', () => {
  const list = between(section, '<ol class="wheel-list"', '</ol>');
  const items = [...list.matchAll(/<li class="wheel-item" data-feature="([^"]+)">([\s\S]*?)<\/li>/g)];
  assert.deepEqual(items.map(match => match[1]), features.map(([id]) => id));
  items.forEach((match, index) => {
    assert.match(match[2], new RegExp(`<button type="button" class="wheel-option"[^>]*>${features[index][1]}</button>`));
  });
  const details = [...section.matchAll(/<article class="wheel-detail" data-feature="([^"]+)">([\s\S]*?)<\/article>/g)];
  assert.deepEqual(details.map(match => match[1]), features.map(([id]) => id));
  details.forEach((match, index) => {
    const [, name, sentence, picture] = features[index];
    assert.match(match[2], new RegExp(`<h3>${name}</h3>`));
    assert.match(match[2], new RegExp(`<p id="wheel-text-${features[index][0]}">${sentence.replace(/[.]/g, '\\.')}</p>`));
    assert.equal(/<img\b/.test(match[2]), Boolean(picture), `${name}: picture only where the plan has one`);
    if (picture) assert.ok(match[2].includes(`src="${picture}"`));
  });
  // Every option is described by its own sentence, even while that detail is hidden.
  for (const [id] of features) assert.match(list, new RegExp(`aria-describedby="wheel-text-${id}"`));
});

test('the four app pictures keep their dialog hooks, titles and alt texts', () => {
  const pictures = [
    ['assets/app-nova-live.png', 'Nova Live — Sonnenenergie anschaulich erklärt', 'Nova-Live-Lernbild größer ansehen', 'Nova Live erklärt den Weg vom Sonnenlicht über Solarmodul und Wechselrichter bis nach Hause, mit einem Diagramm und Alltagsbeispiel', 780, 1688],
    ['assets/app-flashcards.png', 'Karteikarten — dein Wissen aktiv abrufen', 'Karteikarten-Ansicht größer ansehen', 'Zellbiologie-Karteikarte mit der Frage nach der Aufgabe der Mitochondrien und den Optionen zum Wiederholen oder Bestätigen', 780, 1688],
    ['assets/app-podcast.png', 'Lernpodcasts — Zellatmung in fünf Minuten', 'Lernpodcast-Player größer ansehen', 'Novaire-Podcast-Player mit dem Biologie-Podcast Zellatmung in fünf Minuten, Wiedergabesteuerung, Kapiteln und Mitlesefunktion', 402, 874],
    ['assets/app-coding.png', 'Coding — dein Einstieg mit Python, JavaScript oder Java', 'Coding-Bereich größer ansehen', 'Coding-Einstieg in Novaire mit Python, JavaScript und Java, kurzen Beschreibungen und farbigen Codebeispielen', 780, 1688],
  ];
  for (const [src, title, label, alt, width, height] of pictures) {
    const link = section.match(new RegExp(`<a class="wheel-shot" href="${src}"[^>]*>[\\s\\S]*?</a>`))?.[0];
    assert.ok(link, src);
    assert.match(link, /\bdata-preview\b/);
    assert.ok(link.includes(`data-title="${title}"`), title);
    assert.ok(link.includes(`aria-label="${label}"`), label);
    assert.ok(link.includes(`alt="${alt}"`), alt);
    assert.ok(link.includes(`width="${width}" height="${height}"`), `${src} keeps its size`);
    assert.match(link, /loading="lazy"/);
  }
});

test('fine print stays under the section and the counter is decorative', () => {
  assert.match(section, /<p class="fine-print app-gallery-note">Einblicke aus der App mit Beispielinhalten\. Die Beta entwickelt sich weiter\. Die App-Ansichten sind auf Deutsch\.<\/p>\s*<\/section>$/);
  assert.match(section, /<p class="wheel-count" aria-hidden="true" data-no-translate>01 \/ 24<\/p>/);
});

test('head loads the wheel files directly after relaunch.css', () => {
  assert.match(html, /<link rel="stylesheet" href="relaunch.css">\n  <link rel="stylesheet" href="feature-wheel.css">\n  <script type="module" src="feature-wheel.js"><\/script>\n/);
});

test('every visible text in the section has an English entry; product names stay', () => {
  for (const match of section.matchAll(/>([^<>]+)</g)) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (!text || text === '↗' || text === '01 / 24') continue;
    assert.ok(en[text], `missing translation: ${text}`);
  }
  for (const name of ['Nova Chat', 'Nova Live', 'Deep Fokus', 'Coding', 'Community']) assert.equal(en[name], name);
  assert.equal(en['Wort des Tages'], 'Word of the day');
  assert.equal(en['Deine Features,'], 'Your features,');
  assert.equal(en['um besser zu werden.'], 'to get better.');
  for (const [, name, sentence] of features) {
    assert.ok(en[name], name);
    assert.ok(en[sentence], sentence);
  }
});

// ---------- styles ----------

test('without the live flag the details are a plain grid and the wheel list is hidden', () => {
  assert.match(css, /\.wheel-list\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.wheel-details\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.wheel-count\s*\{[^}]*display:\s*none/);
});

test('live mode pins a 100svh stage on a track of 24 × 22svh, only when motion is allowed', () => {
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /\[data-wheel-live\] \.wheel-track\s*\{[^}]*height:\s*calc\(100svh \+ 24 \* 22svh\)/);
  assert.match(css, /\[data-wheel-live\] \.wheel-stage\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*height:\s*100svh/);
  assert.match(css, /transform-origin:\s*left/);
  assert.match(css, /@media \(max-width: 759px\)/);
  assert.doesNotMatch(css, /font-style:\s*italic|serif|cubic-bezier\([^)]*,\s*-|cubic-bezier\([^)]*1\.[1-9]/);
});

// ---------- behaviour in a fake browser ----------

function element(extra = {}) {
  const listeners = {};
  const attributes = {};
  const classes = new Set();
  const style = {
    setProperty(name, value) { this[name] = value; },
    removeProperty(name) { delete this[name]; },
  };
  return {
    listeners, attributes, style, textContent: '', offsetHeight: 0, dataset: {},
    classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, on) => { if (on ?? !classes.has(name)) classes.add(name); else classes.delete(name); return classes.has(name); },
    },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return name in attributes ? attributes[name] : null; },
    removeAttribute(name) { delete attributes[name]; },
    hasAttribute(name) { return name in attributes; },
    toggleAttribute(name, on) { if (on) attributes[name] = ''; else delete attributes[name]; return on; },
    addEventListener(type, callback, options) { (listeners[type] ||= []).push({ callback, options }); },
    removeEventListener(type, callback) { listeners[type] = (listeners[type] || []).filter(entry => entry.callback !== callback); },
    focus() { this.focused = true; },
    ...extra,
  };
}

function harness({ reduced = false, trackTop = 0, scrollY = 2000 } = {}) {
  const items = features.map(([id]) => {
    const button = element();
    const item = element({ dataset: { feature: id }, querySelector: () => button });
    item.button = button;
    return item;
  });
  const details = features.map(([id]) => element({ dataset: { feature: id } }));
  const count = element();
  const list = element();
  const stage = element({ offsetHeight: 800 });
  const box = { top: trackTop };
  const track = element({ offsetHeight: 800 + 24 * 176, getBoundingClientRect: () => ({ top: box.top, height: 800 + 24 * 176 }) });
  const section = element({
    querySelector: (selector) => ({ '.wheel-track': track, '.wheel-stage': stage, '.wheel-list': list, '.wheel-count': count }[selector] ?? null),
    querySelectorAll: (selector) => ({ '.wheel-item': items, '.wheel-detail': details }[selector] ?? []),
  });
  const frames = [];
  const scrolls = [];
  const observers = [];
  const motion = { matches: reduced, listeners: [], addEventListener(type, callback) { this.listeners.push(callback); } };
  const doc = element({ hidden: false });
  const win = element({
    scrollY, document: doc,
    matchMedia: () => motion,
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: () => {},
    scrollTo: (options) => scrolls.push(options),
    getComputedStyle: (target) => ({
      fontSize: target === list ? '40px' : '16px',
      getPropertyValue: (name) => (target === section && name === '--wheel-blur' ? ' 2' : ''),
    }),
    IntersectionObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} },
  });
  let now = 0;
  const runFrames = (step = 16) => {
    let guard = 0;
    while (frames.length && guard++ < 2000) { now += step; frames.shift()(now); }
  };
  return { section, track, stage, list, items, details, count, win, doc, motion, frames, scrolls, observers, box, runFrames,
    setVisible(on) { observers.forEach(observer => observer.callback([{ isIntersecting: on }])); },
    scroll() { (win.listeners.scroll || []).forEach(entry => entry.callback()); } };
}

test('reduced motion leaves the static grid: no live flag, no frames, no inline styles', () => {
  const page = harness({ reduced: true });
  wheel.mountFeatureWheel(page.section, { win: page.win });
  page.setVisible(true);
  page.scroll();
  assert.equal(page.section.hasAttribute('data-wheel-live'), false);
  assert.equal(page.frames.length, 0);
  assert.equal(page.items[3].style.transform, undefined);
});

test('the page scroll drives the wheel; the wheel never listens to wheel or touch input', () => {
  const page = harness();
  wheel.mountFeatureWheel(page.section, { win: page.win });
  assert.equal(page.section.hasAttribute('data-wheel-live'), true);
  for (const target of [page.win, page.doc, page.section, page.track, page.stage, page.list, ...page.items]) {
    for (const type of ['wheel', 'mousewheel', 'touchstart', 'touchmove', 'pointermove']) {
      assert.equal(target.listeners[type], undefined, `no ${type} listener`);
    }
  }
  const scroll = page.win.listeners.scroll?.[0];
  assert.ok(scroll, 'listens to the page scroll');
  assert.equal(scroll.options?.passive, true);
  page.setVisible(true);
  page.runFrames();
  // Track top at 0: progress 0, first feature active.
  assert.ok(page.items[0].classList.contains('is-active'));
  assert.ok(page.details[0].classList.contains('is-active'));
  assert.equal(page.items[0].button.getAttribute('aria-current'), 'true');
  assert.equal(page.items[0].button.getAttribute('tabindex'), '0');
  assert.equal(page.items[1].button.getAttribute('tabindex'), '-1');
  assert.match(page.items[0].style.transform, /^translate\(0px, calc\(0px - 50%\)\) rotate\(0deg\)$/);
  assert.equal(page.items[0].style.opacity, '1');
  assert.equal(page.items[0].style.color, 'rgb(255, 255, 255)');
  assert.match(page.items[2].style.filter, /^blur\(4px\)$/);
  assert.equal(page.items[20].style.visibility, 'hidden');
  assert.equal(page.count.textContent, '01 / 24');
});

test('scrolling eases toward the target feature and marks it active', () => {
  const page = harness();
  wheel.mountFeatureWheel(page.section, { win: page.win });
  page.setVisible(true);
  page.runFrames();
  const travel = 24 * 176;
  page.box.top = -wheel.wheelProgressFor(9, 24) * travel;
  page.scroll();
  assert.equal(page.frames.length, 1, 'one frame per burst of scroll events');
  page.scroll();
  assert.equal(page.frames.length, 1);
  page.frames.shift()(1000);
  page.frames.shift()(1016);
  assert.ok(!page.items[9].classList.contains('is-active'), 'it eases, it does not jump');
  page.runFrames();
  assert.ok(page.items[9].classList.contains('is-active'));
  assert.ok(page.details[9].classList.contains('is-active'));
  assert.ok(!page.details[0].classList.contains('is-active'));
  assert.equal(page.count.textContent, '10 / 24');
  assert.equal(page.frames.length, 0, 'the loop stops once the wheel has settled');
});

test('off screen the scroll costs nothing', () => {
  const page = harness();
  wheel.mountFeatureWheel(page.section, { win: page.win });
  page.setVisible(false);
  page.runFrames();
  page.scroll();
  assert.equal(page.frames.length, 0);
});

test('choosing a feature scrolls the page to its place on the track', () => {
  const page = harness({ trackTop: 300, scrollY: 1000 });
  wheel.mountFeatureWheel(page.section, { win: page.win });
  page.setVisible(true);
  page.runFrames();
  page.items[5].button.listeners.click[0].callback({});
  assert.equal(page.scrolls.length, 1);
  assert.equal(page.scrolls[0].behavior, 'smooth');
  assert.ok(Math.abs(page.scrolls[0].top - (1300 + (5.5 / 24) * 24 * 176)) < 1e-6);
  let prevented = false;
  page.items[0].button.listeners.keydown[0].callback({ key: 'ArrowDown', preventDefault() { prevented = true; } });
  assert.ok(prevented, 'arrow keys on a focused option move one feature');
  assert.ok(Math.abs(page.scrolls[1].top - (1300 + (1.5 / 24) * 24 * 176)) < 1e-6);
  assert.ok(page.items[1].button.focused);
  let ignored = true;
  page.items[0].button.listeners.keydown[0].callback({ key: 'Tab', preventDefault() { ignored = false; } });
  assert.ok(ignored, 'Tab still leaves the wheel');
});

test('switching to reduced motion at runtime returns to the static grid', () => {
  const page = harness();
  wheel.mountFeatureWheel(page.section, { win: page.win });
  page.setVisible(true);
  page.runFrames();
  page.motion.matches = true;
  page.motion.listeners.forEach(callback => callback({ matches: true }));
  assert.equal(page.section.hasAttribute('data-wheel-live'), false);
  for (const item of page.items) {
    for (const property of ['transform', 'opacity', 'filter', 'color', 'visibility']) assert.equal(item.style[property], undefined);
  }
});

test('the module only uses its own section and never blocks scrolling', () => {
  assert.doesNotMatch(js, /addEventListener\(\s*['"](?:wheel|mousewheel|touchstart|touchmove)/);
  assert.doesNotMatch(js, /https?:\/\//);
  assert.doesNotMatch(js, /innerHTML|localStorage|scrollIntoView/);
  assert.match(js, /novaire:languagechange/);
});
