import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { en } from '../public/translations-en.js';
import { translate } from '../public/i18n-core.js';

const root = new URL('../public/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('hero.css', root), 'utf8').catch(() => '');
const js = await readFile(new URL('hero.js', root), 'utf8').catch(() => '');
const hero = await import('../public/hero.js').catch(() => ({}));
const section = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] ?? '';

// ---------- maths ----------

test('heroProgress maps the track position to 0…1 and never divides by zero', () => {
  assert.equal(hero.heroProgress(0, 2600, 1000), 0);
  assert.equal(hero.heroProgress(-800, 2600, 1000), 0.5);
  assert.equal(hero.heroProgress(-1600, 2600, 1000), 1);
  assert.equal(hero.heroProgress(-5000, 2600, 1000), 1);
  assert.equal(hero.heroProgress(300, 2600, 1000), 0);
  assert.equal(hero.heroProgress(-10, 1000, 1000), 0);
  assert.equal(hero.heroProgress(NaN, 2600, 1000), 0);
});

test('act boundaries: opening, countdown takes the stage, hand-over', () => {
  const { ACTS } = hero;
  assert.deepEqual(ACTS.recede, [0.12, 0.34]);
  assert.ok(ACTS.countdown[0] >= 0.12 && ACTS.countdown[1] <= 0.62);
  assert.deepEqual(ACTS.travel, [0.12, 0.62]);
  assert.equal(ACTS.links[0], 0.62);
  assert.ok(ACTS.links[1] < 1);
  for (const [from, to] of Object.values(ACTS)) assert.ok(from < to && from >= 0 && to <= 1);
});

test('act 1 at progress 0: headline and star at rest, countdown and links invisible, cue shown, sky resting', () => {
  const scene = hero.heroScene(0);
  assert.deepEqual(scene.intro, { shift: 0, scale: 1, opacity: 1, blur: 0 });
  assert.deepEqual(scene.mark, { lift: 0, scale: 1 });
  assert.equal(scene.countdown.opacity, 0);
  assert.ok(scene.countdown.y > 0 && scene.countdown.blur > 0);
  assert.equal(scene.links.opacity, 0);
  assert.equal(scene.cue.opacity, 1);
  assert.deepEqual(scene.sky, { travel: 0, flow: 0 });
});

test('the scroll cue fades out as soon as scrolling starts', () => {
  assert.ok(hero.heroScene(0.015).cue.opacity < 1);
  assert.equal(hero.heroScene(0.03).cue.opacity, 0);
});

test('act 2: the headline recedes up, shrinks to .92 and fades; the star shrinks to 60 % at the anchor', () => {
  const end = hero.heroScene(0.5);
  assert.deepEqual(end.intro, { shift: -0.08, scale: 0.92, opacity: 0, blur: 6 });
  assert.deepEqual(end.mark, { lift: 1, scale: 0.6 });
  const mid = hero.heroScene(0.23);
  assert.ok(mid.intro.opacity > 0 && mid.intro.opacity < 1);
  assert.ok(mid.intro.shift < 0 && mid.intro.shift > -0.08);
});

test('the countdown arrives without scale: only opacity, a translate and blur change', () => {
  const before = hero.heroScene(0.29).countdown;
  const arrived = hero.heroScene(0.6).countdown;
  assert.equal(before.opacity, 0);
  assert.deepEqual(arrived, { opacity: 1, y: 0, blur: 0 });
  assert.equal('scale' in arrived, false);
  const mid = hero.heroScene(0.42).countdown;
  assert.ok(mid.opacity > 0 && mid.opacity < 1);
});

test('act 3: the links arrive after the countdown and stay until the stage releases', () => {
  assert.equal(hero.heroScene(0.6).links.opacity, 0);
  assert.deepEqual(hero.heroScene(0.8).links, { opacity: 1, y: 0 });
  assert.deepEqual(hero.heroScene(1).links, { opacity: 1, y: 0 });
  assert.equal(hero.heroScene(1).countdown.opacity, 1);
});

test('every layer moves monotonically with the scroll: no overshoot, no bounce', () => {
  let previous = hero.heroScene(0);
  for (let step = 1; step <= 400; step += 1) {
    const scene = hero.heroScene(step / 400);
    assert.ok(scene.intro.opacity <= previous.intro.opacity);
    assert.ok(scene.intro.scale <= previous.intro.scale && scene.intro.scale >= 0.92);
    assert.ok(scene.mark.scale <= previous.mark.scale && scene.mark.scale >= 0.6);
    assert.ok(scene.mark.lift >= previous.mark.lift && scene.mark.lift <= 1);
    assert.ok(scene.countdown.opacity >= previous.countdown.opacity && scene.countdown.opacity <= 1);
    assert.ok(scene.links.opacity >= previous.links.opacity);
    assert.ok(scene.sky.travel >= previous.sky.travel || scene.sky.flow === 0);
    previous = scene;
  }
});

test('the sky travels forwards through act 2, eases in and out and is at rest outside it', () => {
  assert.deepEqual(hero.heroScene(0.1).sky, { travel: 0, flow: 0 });
  const middle = hero.heroScene(0.37).sky;
  assert.equal(middle.flow, 1);
  assert.ok(middle.travel > 0);
  const early = hero.heroScene(0.14).sky;
  const late = hero.heroScene(0.6).sky;
  assert.ok(early.flow > 0 && early.flow < 1);
  assert.ok(late.flow > 0 && late.flow < 1);
  assert.ok(late.travel > middle.travel, 'never runs backwards while it is visible');
  assert.deepEqual(hero.heroScene(0.62).sky, { travel: 0, flow: 0 });
  assert.deepEqual(hero.heroScene(0.9).sky, { travel: 0, flow: 0 });
});

test('tuning can be overridden for the browser pass', () => {
  const scene = hero.heroScene(1, { tuning: { ...hero.TUNING, anchorScale: 0.5 } });
  assert.equal(scene.mark.scale, 0.5);
  const acts = { ...hero.ACTS, links: [0.9, 0.95] };
  assert.equal(hero.heroScene(0.8, { acts }).links.opacity, 0);
});

test('splitWords splits a translated line into words', () => {
  assert.deepEqual(hero.splitWords(' Lernen wird\n revolutioniert. '), ['Lernen', 'wird', 'revolutioniert.']);
  assert.deepEqual(hero.splitWords('Learning, revolutionised.'), ['Learning,', 'revolutionised.']);
  assert.deepEqual(hero.splitWords(''), []);
});

// ---------- markup ----------

test('hero markup: star button, visible h1 with the name, sub line, countdown block, links, scroll cue', () => {
  assert.match(section, /^<section class="hero" aria-labelledby="brand-title" data-hero>/);
  const order = ['class="hero-track"', 'class="hero-stage"', 'class="hero-anchor"', 'class="hero-mark"', 'class="hero-bloom"', 'class="hero-streak"', 'data-brand-spin',
    '<h1 id="brand-title" class="hero-title">', 'class="hero-sub"', 'class="hero-countdown"', 'data-launch-countdown', 'class="hero-explore-links"', 'class="hero-cue"'];
  let at = -1;
  for (const marker of order) {
    const next = section.indexOf(marker);
    assert.ok(next > at, `${marker} in order`);
    at = next;
  }
  const h1 = section.match(/<h1[\s\S]*?<\/h1>/)[0];
  assert.match(h1, /<span class="hero-line"><span class="hero-line-text">Novaire\.<\/span><\/span>/);
  assert.match(h1, /<span class="hero-line hero-line-soft"><span class="hero-line-text">Lernen wird revolutioniert\.<\/span><\/span>/);
  assert.doesNotMatch(h1, /class="sr-only"/, 'the headline is visible');
  assert.match(section, /<p class="hero-sub"><span>Nicht einfach Antworten\.<\/span> <span>Deine Aha-Momente\.<\/span><\/p>/);
  assert.match(section, /class="launch-countdown-eyebrow" data-launch-status>Bis zum Start</);
  assert.match(section, /<p class="hero-cue" aria-hidden="true">[\s\S]*?>Scrollen</);
  const button = section.match(/<button\b[^>]*data-brand-spin[^>]*>[\s\S]*?<\/button>/)[0];
  assert.match(button, /aria-label="Novaire-Logo einmal drehen"/);
  assert.match(button, /class="brand-symbol"/);
  assert.match(section, /<span class="hero-bloom" aria-hidden="true"><\/span>/);
});

test('the old hero furniture is gone', () => {
  for (const old of ['DEIN UNIVERSUM MIT WISSEN', 'hero-description', 'hero-note', 'hero-index', 'Tippe auf den Stern', 'brand-wordmark-crop', 'brand-interaction-hint', 'hero-copy', 'BALD IM APP STORE']) {
    assert.ok(!section.includes(old), `${old} removed`);
  }
  assert.ok(!section.includes(' style="'));
});

test('hero.css and hero.js load right after the feature wheel', () => {
  assert.match(html, /<script type="module" src="feature-wheel\.js"><\/script>\n  <link rel="stylesheet" href="hero\.css">\n  <script type="module" src="hero\.js"><\/script>\n/);
});

test('every visible hero string has an English entry, next to the other hero entries', async () => {
  assert.equal(en['Novaire.'], 'Novaire.');
  assert.equal(en['Lernen wird revolutioniert.'], 'Learning, revolutionised.');
  assert.equal(en['Bis zum Start'], 'Until launch');
  assert.equal(en['Scrollen'], 'Scroll');
  assert.equal(translate('27. November 2026', 'en'), '27 November 2026');
  for (const text of ['Nicht einfach Antworten.', 'Deine Aha-Momente.', 'App in Aktion', 'Entdecke Novaire', 'Novaire-Logo einmal drehen']) assert.ok(en[text], text);
  const source = await readFile(new URL('translations-en.js', root), 'utf8');
  const anchor = source.indexOf("'Nicht einfach Antworten.'");
  for (const key of ["'Lernen wird revolutioniert.'", "'Bis zum Start'", "'Scrollen'"]) {
    assert.ok(Math.abs(source.indexOf(key) - anchor) < 300, `${key} sits with the hero entries`);
  }
});

// ---------- styles ----------

test('static by default; the pinned stage only exists with [data-hero-live] and motion allowed', () => {
  const live = css.indexOf('[data-hero-live] .hero-stage');
  assert.ok(live > -1);
  assert.ok(css.lastIndexOf('@media (prefers-reduced-motion: no-preference)', live) > -1);
  assert.match(css, /\.hero\[data-hero-live\] \.hero-stage \{[^}]*position: sticky;[^}]*height: 100svh;/);
  assert.match(css, /--hero-track: 260svh;/);
  assert.match(css, /@media \(max-width: 700px\) \{\s*\.marketing-page \.hero \{\s*--hero-track: 230svh;/);
  assert.match(css, /\.hero\[data-hero-live\] \.hero-track \{[^}]*var\(--hero-track\)/);
  // Outside the live block nothing sticks and nothing is hidden.
  const staticPart = css.slice(0, css.indexOf('/* ---------- live scene ---------- */'));
  assert.doesNotMatch(staticPart, /position:\s*sticky/);
  // The only hidden thing at rest is the streak, which only exists during act 1.
  const hidden = [...staticPart.matchAll(/\n([^\n{]+)\{[^}]*opacity:\s*0;/g)].map(match => match[1].trim());
  assert.deepEqual(hidden, ['.hero-streak']);
  assert.match(staticPart, /\.hero-cue \{ display: none; \}/);
});

test('hero styles follow the design rules: Apple type, no italic or serif, no bounce, no pink or red glow, overflow clip', () => {
  assert.doesNotMatch(css, /italic|(?<![\w-])serif\b/i);
  assert.doesNotMatch(css, /cubic-bezier\([^)]*,\s*1\.\d|cubic-bezier\([^)]*-\s*0?\.\d/);
  // The only overflow-hidden box is the visually hidden source line of the split headline: no light in it.
  assert.doesNotMatch(css.replace(/\.hero-title\.is-split \.hero-line-text \{[^}]*\}/, ''), /overflow:\s*hidden/);
  // No pink or red light: no colour where red clearly leads green and blue.
  for (const [hex] of css.matchAll(/#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/gi)) {
    const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
    assert.ok(!(r > g + 40 && r > b + 20), `${hex} is reddish`);
  }
  assert.doesNotMatch(css, /rgba?\(/, 'colours are hex, checked above');
  assert.match(css, /\.hero-title \{[^}]*font-family: var\(--font-apple\);[^}]*font-weight: 600;[^}]*line-height: 1\.02;/);
  assert.match(css, /\.hero \.launch-countdown-eyebrow \{[^}]*font-weight: 600;[^}]*letter-spacing: -\.01em;[^}]*text-transform: none;/);
  assert.match(css, /--hero-digit-size: clamp\(56px, 10vw, 148px\)/);
  assert.match(css, /font-variant-numeric|launch-countdown-value/);
  assert.match(css, /--hero-bar-width: 720px/);
  assert.match(css, /overflow-x: clip/);
});

test('act 1 timing lives in custom properties and plays only with data-hero-intro="play"', () => {
  for (const name of ['--hero-mark-at', '--hero-bloom-dur', '--hero-streak-at', '--hero-words-at', '--hero-word-step: 90ms', '--hero-sub-at', '--hero-cue-at']) assert.ok(css.includes(name), name);
  assert.match(css, /\[data-hero-intro="play"\] \.hero-word \{[^}]*animation-delay: calc\(var\(--hero-words-at\) \+ var\(--i, 0\) \* var\(--hero-word-step\)\)/);
  assert.match(css, /@keyframes hero-word-in \{\s*from \{ opacity: 0; transform: translate3d\(0, 14px, 0\); filter: blur\(10px\); \}/);
  assert.match(css, /@keyframes hero-mark-in \{\s*from \{ opacity: 0; filter: blur\(14px\); transform: scale\(\.94\); \}/);
});

test('the arrived state keeps the arrival line large and centred', () => {
  assert.match(css, /\.hero \.launch-countdown-arrived \{[^}]*font-size: clamp\(36px, 5\.6vw, 80px\);[^}]*text-align: center;/);
  assert.match(css, /\.hero \.launch-countdown\[data-state="arrived"\] \.launch-countdown-date \{ display: none; \}/);
});

// ---------- script ----------

test('hero.js never captures the scroll and writes only transform, opacity, filter and visibility', () => {
  assert.doesNotMatch(js, /preventDefault|addEventListener\(\s*['"](?:wheel|touch\w*|keydown)/);
  assert.equal((js.match(/addEventListener\('scroll'/g) || []).length, 1);
  assert.match(js, /addEventListener\('scroll', request, \{ passive: true \}\)/);
  assert.match(js, /requestAnimationFrame\(update\)/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /novaire:languagechange/);
  const writes = [...js.matchAll(/\.style\.(\w+)\s*=/g)].map(match => match[1]);
  for (const property of writes) assert.ok(['transform', 'opacity', 'filter', 'visibility'].includes(property), property);
  assert.doesNotMatch(js, /\bfetch\(|localStorage|sessionStorage|innerHTML/);
});

test('stars.js accepts an optional flow so the flight can fade without the stars rushing back', async () => {
  const stars = await readFile(new URL('stars.js', root), 'utf8');
  assert.match(stars, /Number\.isFinite\(sky\.flow\)/);
  assert.match(stars, /if \(flow < 1\) drawField\(time, scroll, 0, 1 - flow, lens\);/);
});

// ---------- the scene against a small fake DOM ----------

function fakeElement(tag = 'span', extra = {}) {
  const attributes = new Map();
  const styles = new Map();
  const element = {
    tagName: tag.toUpperCase(),
    children: [],
    childNodes: [],
    parent: null,
    className: '',
    dataset: {},
    offsetTop: 0,
    offsetHeight: 0,
    offsetParent: null,
    _text: '',
    style: {
      setProperty(name, value) { styles.set(name, String(value)); },
      removeProperty(name) { styles.delete(name); },
      getPropertyValue(name) { return styles.get(name) ?? ''; },
    },
    styles,
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
    toggleAttribute(name, force) {
      const on = force ?? !attributes.has(name);
      if (on) attributes.set(name, ''); else attributes.delete(name);
      return on;
    },
    append(...nodes) {
      for (const node of nodes) {
        if (typeof node === 'string') { element.childNodes.push(node); continue; }
        node.parent = element;
        element.children.push(node);
        element.childNodes.push(node);
      }
    },
    remove() {
      const parent = element.parent;
      if (!parent) return;
      parent.children = parent.children.filter(child => child !== element);
      parent.childNodes = parent.childNodes.filter(child => child !== element);
      element.parent = null;
    },
    get textContent() {
      if (!element.childNodes.length) return element._text;
      return element.childNodes.map(node => (typeof node === 'string' ? node : node.textContent)).join('');
    },
    set textContent(value) { element.childNodes = []; element.children = []; element._text = String(value); },
    querySelector(selector) { return element.querySelectorAll(selector)[0] ?? null; },
    querySelectorAll(selector) {
      const name = selector.replace(/^\./, '');
      const found = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (child.className.split(' ').includes(name) || child.classList.contains(name)) found.push(child);
          walk(child);
        }
      };
      walk(element);
      return found;
    },
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    ...extra,
  };
  // Real style properties used by hero.js.
  for (const key of ['transform', 'opacity', 'filter', 'visibility']) {
    Object.defineProperty(element.style, key, {
      get: () => styles.get(key) ?? '',
      set: (value) => { if (value === '') styles.delete(key); else styles.set(key, String(value)); },
      enumerable: true,
    });
  }
  return element;
}

function mountFake({ reduced = false, tall = true, scrollTop = 0 } = {}) {
  const make = (className, extra) => { const node = fakeElement('div', extra); node.className = className; return node; };
  const section = make('hero');
  const track = make('hero-track', { offsetHeight: 2600 });
  const stage = make('hero-stage', { offsetHeight: 1000 });
  const anchor = make('hero-anchor', { offsetTop: 76 });
  const opening = make('hero-opening');
  const markNode = make('hero-mark', { offsetTop: 199 });
  const intro = make('hero-intro');
  const title = make('hero-title');
  const lineOne = make('hero-line');
  const lineTwo = make('hero-line hero-line-soft');
  const textOne = make('hero-line-text');
  const textTwo = make('hero-line-text');
  textOne.textContent = 'Novaire.';
  textTwo.textContent = 'Lernen wird revolutioniert.';
  const countdown = make('hero-countdown');
  const links = make('hero-explore-links');
  const cue = make('hero-cue');
  section.append(track); track.append(stage); stage.append(anchor, opening, countdown, cue);
  opening.append(markNode, intro); intro.append(title); title.append(lineOne, lineTwo);
  lineOne.append(textOne); lineTwo.append(textTwo); countdown.append(links);
  anchor.offsetParent = stage; markNode.offsetParent = stage;

  let top = -scrollTop;
  track.getBoundingClientRect = () => ({ top, left: 0, width: 1440, height: 2600 });
  const listeners = {};
  const docListeners = {};
  const media = {};
  const frames = [];
  const observers = [];
  const timers = [];
  const win = {
    novaireSky: { travel: 0 },
    document: {
      hidden: false,
      createElement: (tag) => fakeElement(tag),
      addEventListener: (type, callback) => { (docListeners[type] ||= []).push(callback); },
    },
    matchMedia(query) {
      const entry = { matches: query.includes('reduced-motion') ? reduced : tall, listeners: [], addEventListener(type, callback) { this.listeners.push(callback); } };
      media[query.includes('reduced-motion') ? 'motion' : 'tall'] = entry;
      return entry;
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => (name === '--hero-anchor-scale' ? ' .6' : '') }),
    addEventListener: (type, callback) => { (listeners[type] ||= []).push(callback); },
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: () => {},
    setTimeout: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    clearTimeout: () => {},
    IntersectionObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} },
  };
  const api = hero.mountHero(section, { win });
  return {
    api, win, section, track, stage, intro, markNode, countdown, links, cue, title, lineTwo, textTwo, frames, timers, media, docListeners, listeners,
    setNear(value) { observers[0].callback([{ isIntersecting: value }]); },
    scrollTo(progress) {
      top = -progress * 1600;
      listeners.scroll.forEach(callback => callback());
      while (frames.length) frames.shift()(16);
    },
  };
}

test('mountHero goes live, splits the headline into words and plays act 1', () => {
  const page = mountFake();
  assert.ok(page.section.hasAttribute('data-hero-live'));
  assert.equal(page.section.hasAttribute('data-hero-static'), false);
  assert.equal(page.section.getAttribute('data-hero-intro'), 'play');
  assert.ok(page.timers.some(timer => timer.ms === hero.INTRO_MS));
  assert.ok(page.title.classList.contains('is-split'));
  const words = page.section.querySelectorAll('hero-word');
  assert.deepEqual(words.map(word => word.textContent), ['Novaire.', 'Lernen', 'wird', 'revolutioniert.']);
  assert.deepEqual(words.map(word => word.style.getPropertyValue('--i')), ['0', '1', '2', '3']);
  const visible = page.lineTwo.querySelector('hero-words');
  assert.equal(visible.getAttribute('aria-hidden'), 'true');
  assert.ok(visible.hasAttribute('data-no-translate'));
  assert.equal(page.textTwo.textContent, 'Lernen wird revolutioniert.', 'the real line stays for assistive technology and translation');
  assert.ok(page.countdown.hasAttribute('inert'), 'the invisible countdown is not reachable');
  assert.ok(page.links.hasAttribute('inert'));
  assert.equal(page.countdown.style.opacity, '0');
  assert.doesNotMatch(page.countdown.style.transform, /scale/);
});

test('scrolling drives the acts; the star rises to the measured anchor; inert follows visibility', () => {
  const page = mountFake();
  page.setNear(true);
  page.scrollTo(0.5);
  assert.equal(page.intro.style.opacity, '0');
  assert.match(page.markNode.style.transform, /translate3d\(0, -123px, 0\) scale\(0\.6\)/);
  assert.equal(page.countdown.hasAttribute('inert'), false);
  assert.ok(page.links.hasAttribute('inert'));
  assert.equal(page.win.novaireSky.flow, 1);
  assert.ok(page.win.novaireSky.travel > 0);
  page.scrollTo(0.9);
  assert.equal(page.links.hasAttribute('inert'), false);
  assert.equal(page.links.style.opacity, '1');
  assert.equal(page.win.novaireSky.travel, 0, 'the sky is handed back at rest');
  assert.equal('flow' in page.win.novaireSky, false);
  assert.ok(page.cue.hasAttribute('data-hero-cue-gone'));
});

test('off screen nothing runs and the sky is released', () => {
  const page = mountFake();
  page.setNear(true);
  page.scrollTo(0.4);
  assert.equal(page.win.novaireSky.flow, 1);
  page.setNear(false);
  assert.equal(page.win.novaireSky.travel, 0);
  assert.equal('flow' in page.win.novaireSky, false);
  page.listeners.scroll.forEach(callback => callback());
  assert.equal(page.frames.length, 0, 'no frame is requested while the hero is off screen');
});

test('a reload further down the track skips act 1', () => {
  const page = mountFake({ scrollTop: 800 });
  assert.equal(page.section.getAttribute('data-hero-intro'), 'done');
});

test('a language switch rebuilds the visible words from the translated line', () => {
  const page = mountFake();
  page.textTwo.textContent = 'Learning, revolutionised.';
  page.docListeners['novaire:languagechange'].forEach(callback => callback());
  assert.deepEqual(page.section.querySelectorAll('hero-word').map(word => word.textContent), ['Novaire.', 'Learning,', 'revolutionised.']);
});

test('reduced motion and short screens keep the static hero: no attribute, no split, no inline styles', () => {
  for (const options of [{ reduced: true }, { tall: false }]) {
    const page = mountFake(options);
    assert.equal(page.section.hasAttribute('data-hero-live'), false);
    assert.ok(page.section.hasAttribute('data-hero-static'));
    assert.equal(page.title.classList.contains('is-split'), false);
    assert.equal(page.section.querySelectorAll('hero-word').length, 0);
    assert.equal(page.countdown.hasAttribute('inert'), false);
    assert.equal(page.countdown.style.opacity, '');
  }
  const page = mountFake();
  page.setNear(true);
  page.scrollTo(0.4);
  page.media.motion.matches = true;
  page.media.motion.listeners.forEach(callback => callback());
  assert.equal(page.section.hasAttribute('data-hero-live'), false);
  assert.equal(page.section.querySelectorAll('hero-word').length, 0);
  assert.equal(page.intro.style.transform, '');
  assert.equal(page.countdown.hasAttribute('inert'), false);
  assert.equal(page.win.novaireSky.travel, 0);
});

test('the countdown makes no particles while the hero keeps it inert', async () => {
  const script = await readFile(new URL('launch-countdown.js', root), 'utf8');
  assert.match(script, /const veiled = \(\) => Boolean\(banner\.closest\?\.\('\[inert\]'\)\);/);
  assert.match(script, /inView && !veiled\(\)/);
  assert.match(script, /'27\. November 2026'/);
});
