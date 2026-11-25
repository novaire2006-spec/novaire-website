import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translate } from '../public/i18n-core.js';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
const headerOf = (html) => html.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0];
const panelOf = (header) => header.match(/<div id="site-panel"[\s\S]*?<\/nav>\s*<\/div>/)?.[0];

// Every link the old "Menü" dropdown had, with its label.
const oldMenu = [
  ['#inhalt', 'Startseite'], ['#entdecken', 'Die App'], ['#app-in-aktion', 'App in Aktion'],
  ['#intelligenz', 'Die KI dahinter'], ['#belohnungen', 'Belohnungen'], ['#plaene', 'Preise'],
  ['#updates', 'Updates &amp; Meilensteine'], ['#geschichte', 'Unsere Geschichte'], ['#community', 'Community'],
  ['beta.html', 'Beta testen'], ['support.html', 'Support'], ['datenschutz.html', 'Datenschutz'],
  ['impressum.html', 'Impressum'], ['agb.html', 'AGB'],
];
const topLinks = [
  ['#entdecken', 'Die App'], ['#features', 'Features'], ['#app-in-aktion', 'In Aktion'],
  ['#belohnungen', 'Belohnungen'], ['#plaene', 'Preise'], ['#geschichte', 'Geschichte'],
];

test('the old dropdown and its search field are gone from the landing page', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /<details class="menu/);
  assert.doesNotMatch(html, /glass-search|type="search"/);
});

test('header is a top bar: wordmark, centre links, language, beta link and a menu toggle', async () => {
  const header = headerOf(await read('index.html'));
  assert.ok(header, 'header block');
  assert.match(header, /^<header class="site-header" data-topbar>\s*<div class="topbar">/);
  const bar = header.match(/<div class="topbar">[\s\S]*?<\/div>\s*<\/div>/)?.[0];
  assert.ok(bar, 'topbar block');
  assert.match(bar, /<a class="header-wordmark" href="#inhalt"/);
  const nav = bar.match(/<nav class="topbar-links"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'nav.topbar-links');
  assert.match(nav[0], /aria-label="Hauptnavigation"/);
  const links = [...nav[1].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, topLinks);
  assert.ok(bar.indexOf('header-wordmark') < bar.indexOf('topbar-links'));
  assert.ok(bar.indexOf('topbar-links') < bar.indexOf('data-language-toggle'));
  assert.match(bar, /<button type="button" class="language-toggle" data-language-toggle[^>]*hidden><span data-language-label>EN<\/span><\/button>/);
  assert.match(bar, /<a class="header-link header-beta-link" href="beta\.html">Zur Beta/);
  const toggle = bar.match(/<button[^>]+class="topbar-toggle"[^>]*>/)?.[0];
  assert.ok(toggle, 'button.topbar-toggle');
  assert.match(toggle, /type="button"/);
  assert.match(toggle, /aria-expanded="false"/);
  assert.match(toggle, /aria-controls="site-panel"/);
  assert.match(toggle, /aria-label="Menü öffnen"/);
});

test('#site-panel holds every old menu link with its label, plus Features, readable without JavaScript', async () => {
  const header = headerOf(await read('index.html'));
  const panel = panelOf(header);
  assert.ok(panel, 'div#site-panel');
  assert.match(panel, /^<div id="site-panel" class="site-panel">/);
  assert.doesNotMatch(panel, /\shidden[\s>]|inert|aria-hidden="true"/, 'panel content stays in the HTML, not hidden by markup');
  for (const [href, label] of oldMenu) {
    assert.match(panel, new RegExp(`<a href="${href.replace('.', '\\.')}"><span>${label}</span></a>`), `${href} ${label}`);
  }
  assert.match(panel, /<a href="#features"><span>Features<\/span><\/a>/);
  const groups = [...panel.matchAll(/<div class="site-panel-group[^"]*"><p>([^<]+)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['Die App entdecken', 'Mehr entdecken', 'Hilfe &amp; Rechtliches']);
  assert.ok(header.indexOf('class="topbar"') < header.indexOf('id="site-panel"'));
});

test('every visible header string and label has an English entry', async () => {
  const header = headerOf(await read('index.html'));
  const texts = [...header.matchAll(/>([^<>]+)</g)].map((m) => m[1].replace(/&amp;/g, '&').trim())
    .filter((text) => text && !['↗', 'EN', 'Novaire', 'Features', 'Community', 'Support', 'AGB'].includes(text));
  const labels = [...header.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
  for (const text of [...texts, ...labels, 'Menü schließen']) {
    assert.notEqual(translate(text, 'en'), text, `Missing translation: ${text}`);
  }
  assert.equal(translate('Features', 'en'), 'Features');
});

test('the skip link still leads to the content and the wordmark goes home', async () => {
  const html = await read('index.html');
  assert.ok(html.indexOf('class="skip-link" href="#inhalt"') < html.indexOf('<header class="site-header"'));
  assert.match(html, /<main id="inhalt">/);
});

// A fake DOM, just enough for createMenu: attributes, listeners, containment, focus.
function makeDom() {
  const doc = { activeElement: null, listeners: {}, addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); } };
  const el = (name, { visible = true, focusVisible = true } = {}) => {
    const node = {
      name, attrs: new Map(), listeners: {}, children: [], parent: null, focusVisible,
      setAttribute(key, value) { this.attrs.set(key, String(value)); },
      getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null; },
      hasAttribute(key) { return this.attrs.has(key); },
      removeAttribute(key) { this.attrs.delete(key); },
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
      contains(other) { for (let n = other; n; n = n.parent) if (n === this) return true; return false; },
      closest(selector) { for (let n = this; n; n = n.parent) if (n.name.split(' ')[0] === selector) return n; return null; },
      matches(selector) { return selector === ':focus-visible' ? this.focusVisible : false; },
      querySelector(selector) { return find(this, selector); },
      querySelectorAll() { return []; },
      getClientRects() { return visible ? [{}] : []; },
      focus() { const before = doc.activeElement; doc.activeElement = this; emitFocus(before, this); },
      append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } return this; },
    };
    return node;
  };
  const find = (root, selector) => {
    for (const child of root.children) {
      if (child.name === selector.replace(/^\./, '')) return child;
      const deep = find(child, selector);
      if (deep) return deep;
    }
    return null;
  };
  const fire = (node, type, event = {}) => {
    const full = { type, target: node, preventDefault() {}, ...event };
    for (let n = node; n; n = n.parent) for (const fn of n.listeners[type] ?? []) fn({ ...full, currentTarget: n });
    if (event.bubblesToDocument !== false) for (const fn of doc.listeners[type] ?? []) fn(full);
  };
  const enter = (node, pointerType = 'mouse') => { for (const fn of node.listeners.pointerenter ?? []) fn({ type: 'pointerenter', target: node, pointerType }); };
  const leave = (node, pointerType = 'mouse') => { for (const fn of node.listeners.pointerleave ?? []) fn({ type: 'pointerleave', target: node, pointerType }); };
  function emitFocus(from, to) {
    if (from) fire(from, 'focusout', { relatedTarget: to, bubblesToDocument: false });
    if (to) fire(to, 'focusin', { relatedTarget: from, bubblesToDocument: false });
  }
  const header = el('site-header');
  const bar = el('topbar');
  const links = el('topbar-links');
  const topLink = el('a top');
  const toggle = el('topbar-toggle');
  const panel = el('site-panel');
  const panelLink = el('a panel');
  const outside = el('main');
  links.append(topLink);
  bar.append(links, toggle);
  panel.append(panelLink);
  header.append(bar, panel);
  return { doc, header, bar, links, topLink, toggle, panel, panelLink, outside, fire, enter, leave, el };
}

const load = () => import('../public/navigation.js');

test('navigation.js loads without a browser and exports createMenu', async () => {
  const { createMenu } = await load();
  assert.equal(typeof createMenu, 'function');
  const dom = makeDom();
  const menu = createMenu({ header: dom.header, panel: dom.panel, toggle: dom.toggle, canHover: false, doc: dom.doc });
  assert.equal(typeof menu.open, 'function');
  assert.equal(typeof menu.close, 'function');
  assert.equal(menu.isOpen(), false);
  assert.equal(dom.header.hasAttribute('data-menu-ready'), true);
});

test('open() and close() set aria-expanded, the label and data-open on the header', async () => {
  const { createMenu } = await load();
  const dom = makeDom();
  const menu = createMenu({ header: dom.header, panel: dom.panel, toggle: dom.toggle, canHover: false, doc: dom.doc });
  menu.open();
  assert.equal(menu.isOpen(), true);
  assert.equal(dom.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(dom.toggle.getAttribute('aria-label'), 'Menü schließen');
  assert.equal(dom.header.hasAttribute('data-open'), true);
  menu.close();
  assert.equal(menu.isOpen(), false);
  assert.equal(dom.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(dom.toggle.getAttribute('aria-label'), 'Menü öffnen');
  assert.equal(dom.header.hasAttribute('data-open'), false);
});

test('tap: the toggle opens and closes; tap outside, Escape and choosing a link close', async () => {
  const { createMenu } = await load();
  const dom = makeDom();
  const menu = createMenu({ header: dom.header, panel: dom.panel, toggle: dom.toggle, canHover: false, doc: dom.doc });
  dom.fire(dom.toggle, 'click');
  assert.equal(menu.isOpen(), true);
  dom.fire(dom.panel, 'click');
  assert.equal(menu.isOpen(), true, 'a tap inside the panel but not on a link keeps it open');
  dom.fire(dom.toggle, 'click');
  assert.equal(menu.isOpen(), false);

  dom.fire(dom.toggle, 'click');
  dom.fire(dom.outside, 'click');
  assert.equal(menu.isOpen(), false, 'tap outside');

  dom.fire(dom.toggle, 'click');
  dom.fire(dom.header, 'click');
  assert.equal(menu.isOpen(), false, 'tap on the dimmed page (the header scrim)');

  dom.fire(dom.toggle, 'click');
  dom.fire(dom.panelLink, 'click');
  assert.equal(menu.isOpen(), false, 'choosing a link');

  dom.fire(dom.toggle, 'click');
  for (const fn of dom.doc.listeners.keydown) fn({ key: 'Enter' });
  assert.equal(menu.isOpen(), true);
  for (const fn of dom.doc.listeners.keydown) fn({ key: 'Escape' });
  assert.equal(menu.isOpen(), false, 'Escape');
});

test('Escape from inside the panel returns focus to the toggle', async () => {
  const { createMenu } = await load();
  const dom = makeDom();
  const menu = createMenu({ header: dom.header, panel: dom.panel, toggle: dom.toggle, canHover: false, doc: dom.doc });
  dom.fire(dom.toggle, 'click');
  dom.panelLink.focus();
  for (const fn of dom.doc.listeners.keydown) fn({ key: 'Escape' });
  assert.equal(menu.isOpen(), false);
  assert.equal(dom.doc.activeElement, dom.toggle);
});

test('hover: entering the link area opens, leaving bar and panel closes after 160 ms', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { createMenu } = await load();
  const dom = makeDom();
  const menu = createMenu({ header: dom.header, panel: dom.panel, toggle: dom.toggle, canHover: () => true, doc: dom.doc });
  dom.enter(dom.links);
  assert.equal(menu.isOpen(), true);
  dom.leave(dom.bar);
  dom.enter(dom.panel);
  t.mock.timers.tick(400);
  assert.equal(menu.isOpen(), true, 'moving from the bar into the panel keeps it open');
  dom.leave(dom.panel);
  t.mock.timers.tick(150);
  assert.equal(menu.isOpen(), true, 'still open before 160 ms');
  t.mock.timers.tick(20);
  assert.equal(menu.isOpen(), false, 'closed after 160 ms');
});

test('hover is ignored on devices that cannot hover and for touch pointers', async () => {
  const { createMenu } = await load();
  const noHover = makeDom();
  const a = createMenu({ header: noHover.header, panel: noHover.panel, toggle: noHover.toggle, canHover: () => false, doc: noHover.doc });
  noHover.enter(noHover.links);
  assert.equal(a.isOpen(), false);
  const hybrid = makeDom();
  const b = createMenu({ header: hybrid.header, panel: hybrid.panel, toggle: hybrid.toggle, canHover: () => true, doc: hybrid.doc });
  hybrid.enter(hybrid.links, 'touch');
  assert.equal(b.isOpen(), false);
});

test('a menu opened by tap does not close when a mouse pointer wanders off', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { createMenu } = await load();
  const dom = makeDom();
  const menu = createMenu({ header: dom.header, panel: dom.panel, toggle: dom.toggle, canHover: () => true, doc: dom.doc });
  dom.fire(dom.toggle, 'click');
  dom.leave(dom.bar);
  t.mock.timers.tick(500);
  assert.equal(menu.isOpen(), true);
});

test('keyboard focus in the link area opens the panel; focus leaving the header closes it', async () => {
  const { createMenu } = await load();
  const dom = makeDom();
  const menu = createMenu({ header: dom.header, panel: dom.panel, toggle: dom.toggle, canHover: () => true, doc: dom.doc });
  dom.topLink.focus();
  assert.equal(menu.isOpen(), true);
  dom.panelLink.focus();
  assert.equal(menu.isOpen(), true);
  dom.outside.focus();
  assert.equal(menu.isOpen(), false);

  const mouse = makeDom();
  const m = createMenu({ header: mouse.header, panel: mouse.panel, toggle: mouse.toggle, canHover: () => false, doc: mouse.doc });
  mouse.topLink.focusVisible = false;
  mouse.topLink.focus();
  assert.equal(m.isOpen(), false, 'focus from a mouse or tap does not open it');
});

test('CSS: fixed translucent bar, panel drop, scrim, no-JS fallback, scroll padding, calm motion', async () => {
  const css = await read('navigation.css');
  const relaunch = await read('relaunch.css');
  assert.match(css, /--topbar-h:\s*52px/);
  assert.match(css, /@media \(max-width: 700px\) \{[^}]*--topbar-h:\s*48px/);
  assert.match(css, /\.site-header\[data-topbar\][^{]*\{[^}]*position:\s*fixed/);
  assert.match(css, /backdrop-filter:\s*blur\(20px\) saturate\(1\.6\)/);
  assert.match(css, /#ffffff14/);
  assert.match(css, /scroll-padding-top:\s*var\(--topbar-h\)/);
  assert.doesNotMatch(relaunch, /scroll-padding/, 'relaunch.css must not override the scroll padding');
  assert.match(css, /clip-path/);
  assert.match(css, /\.32s var\(--ease-out\)|320ms var\(--ease-out\)/);
  assert.match(css, /transition-delay:\s*(?:80ms|\.08s)/);
  assert.match(css, /\.site-header\[data-topbar\]::after/);
  assert.match(css, /@media \(scripting: none\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /max-width: 899\.98px/);
  assert.doesNotMatch(css, /italic|serif/i);
  for (const [, args] of css.matchAll(/cubic-bezier\(([^)]+)\)/g)) {
    const [, y1, , y2] = args.split(',').map(Number);
    assert.ok(y1 >= 0 && y1 <= 1 && y2 >= 0 && y2 <= 1, `no overshoot: cubic-bezier(${args})`);
  }
});
