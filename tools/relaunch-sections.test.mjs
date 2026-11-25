import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countUpValue, formatCount } from '../public/count-up.js';
import { storyState } from '../public/storyline.js';
import { en } from '../public/translations-en.js';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
const html = await read('index.html');
const section = (id) => html.match(new RegExp(`<section[^>]+id="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';

test('count-up runs from 0 to the target in 900 ms with an ease-out and stays there', () => {
  assert.equal(countUpValue(0, 3712), 0);
  assert.equal(countUpValue(900, 3712), 3712);
  assert.equal(countUpValue(5000, 3712), 3712);
  assert.equal(countUpValue(-20, 3712), 0);
  let previous = -1;
  for (let ms = 0; ms <= 900; ms += 50) {
    const value = countUpValue(ms, 3712);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= previous, `not monotonic at ${ms} ms`);
    previous = value;
  }
  // Ease-out: more than half of the number is already there at a third of the time.
  assert.ok(countUpValue(300, 3712) > 3712 / 2);
  assert.equal(countUpValue(450, 1000, 450), 1000);
});

test('counts are grouped the German way, and the English way when asked', () => {
  assert.equal(formatCount(3712), '3.712');
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1234567), '1.234.567');
  assert.equal(formatCount(3712, 'en'), '3,712');
});

test('story state: line progress follows the 60 % mark and chapters are reached once their top passes it', () => {
  const state = storyState({ listTop: 200, listHeight: 1000, chapterTops: [200, 500, 900], viewportHeight: 1000 });
  assert.equal(state.progress, 0.4);
  assert.deepEqual(state.reached, [true, true, false]);
  assert.equal(storyState({ listTop: 900, listHeight: 1000, chapterTops: [900], viewportHeight: 1000 }).progress, 0);
  assert.equal(storyState({ listTop: -2000, listHeight: 1000, chapterTops: [-2000], viewportHeight: 1000 }).progress, 1);
  assert.equal(storyState({ listTop: 0, listHeight: 0, chapterTops: [], viewportHeight: 800 }).progress, 1);
});

test('timeline: no pictures, no canvas, no controls, the nine chapters keep their dates and texts', () => {
  const story = section('geschichte');
  assert.ok(story);
  assert.doesNotMatch(story, /<img\b|<canvas\b|chapter-controls|chapter-art|chapter-plate|<button\b/);
  const chapters = [...story.matchAll(/<li data-chapter="([^"]+)" class="chapter[^"]*">([\s\S]*?)<\/li>/g)];
  assert.deepEqual(chapters.map(match => match[1]), ['first', 'name', 'build', 'orb', 'public', 'apply', 'community', 'beta', 'launch']);
  const dates = chapters.map(match => match[2].match(/<time datetime="[^"]+">([^<]+)<\/time>/)?.[1]);
  assert.deepEqual(dates, ['27.11.2025', '28.11.2025', '09.12.2025', '23.04.2026', '10.10.2026', '15.10.2026', '31.10.2026', '07.11.2026', '27.11.2026']);
  for (const text of [
    'Die Idee.', 'Der erste Gedanke an eine neue Art zu lernen.',
    'Ein Name. Ein Logo. Eine Website.', 'Wir beginnen zu bauen. Unser erster Name: Lenova.',
    'Aus der Website wird eine App.', 'Die Idee des Live Orbs.', 'Wir zeigen euch Novaire.',
    'Die Beta-Bewerbungen öffnen.', 'Die Bewerbungsrunde ist abgeschlossen.', 'Bewerbungen. Ein riesiges Danke.',
    'Die Beta ist gestartet.', 'Der Launch rückt näher.',
    'Der Start im App Store ist für den 27. November um 18 Uhr MEZ angekündigt.',
  ]) assert.ok(story.includes(text), text);
  assert.match(story, /<strong class="story-count" data-count-to="3712" data-no-translate>3\.712<\/strong>/);
  assert.match(story, /<h2 id="story-title">Von Lenova zu Novaire<\/h2>/);
});

test('socials: three round logo links with the existing destinations, safe new-tab links and names', () => {
  const community = section('community');
  const list = community.match(/<ul class="social-orbs[^"]*"[^>]*>([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(list, 'ul.social-orbs exists');
  assert.doesNotMatch(community, /social-links|social-arrow/);
  const links = [...list.matchAll(/<a class="social-orb social-(\w+)" href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(match => [match[1], match[2]]), [
    ['instagram', 'https://www.instagram.com/novaireapp'],
    ['tiktok', 'https://www.tiktok.com/@novaireapp'],
    ['discord', 'https://discord.gg/novaireai'],
  ]);
  for (const [, name, , attributes, inner] of links) {
    assert.match(attributes, /target="_blank"/);
    assert.match(attributes, /rel="noopener noreferrer"/);
    assert.match(attributes, /aria-label="Novaire auf \w+ \(neuer Tab\)"/);
    assert.match(inner, /<span class="social-fill" aria-hidden="true"><\/span>/);
    assert.match(inner, new RegExp(`<img src="assets/social-${name}.svg" width="26" height="26" alt="">`));
    assert.match(inner, /<span class="social-name"><strong>[^<]+<\/strong><span>[^<]+<\/span><\/span>/);
  }
  assert.equal([...list.matchAll(/<li>/g)].length, 3);
  assert.match(community, /class="business-contact/);
});

test('socials: brand fills, readable logos, names always visible without hover, fill rises without overshoot', async () => {
  const css = await read('relaunch-sections.css');
  assert.match(css, /\.social-instagram\s*\{[^}]*--brand:\s*#E1306C/i);
  assert.match(css, /\.social-tiktok\s*\{[^}]*--brand:\s*#25F4EE/i);
  assert.match(css, /\.social-discord\s*\{[^}]*--brand:\s*#5865F2/i);
  assert.match(css, /\.social-orb\s*\{[^}]*width:\s*64px[^}]*height:\s*64px/);
  // The hidden-until-hover name only exists for devices that can hover with a fine pointer.
  const hoverBlock = css.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(hoverBlock, /\.social-name\s*\{[^}]*opacity:\s*0/);
  const outside = css.replace(/@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\n\}/, '');
  assert.doesNotMatch(outside, /\.social-name\s*\{[^}]*opacity:\s*0/);
  assert.match(css, /\.social-orb:is\(:hover, :focus-visible\) \.social-fill/);
  assert.doesNotMatch(css, /cubic-bezier\([^)]*(?:-\d|1\.[1-9])/, 'no overshoot easing');
  assert.doesNotMatch(css, /font-style:\s*italic|serif/);
});

test('Free and Pro: one calm figure with the example caption, no picker, no curve cards, the method stays', () => {
  const growth = section('free-pro');
  assert.ok(growth);
  assert.doesNotMatch(growth, /<select\b|peak-pair|peak-card|peak-picker/);
  assert.match(growth, /<h2 id="growth-title">Mehr Pro\.<br><span class="muted">Mehr für Free\.<\/span><\/h2>/);
  const figure = growth.match(/<figure class="growth-figure"[\s\S]*?<\/figure>/)?.[0];
  assert.ok(figure);
  assert.match(figure, /<svg[^>]+viewBox="0 0 640 260"/);
  assert.equal([...figure.matchAll(/class="growth-line growth-line-(?:pro|free)"/g)].length, 2);
  assert.match(figure, />Pro \+40 %</);
  assert.match(figure, />Free \+20 %</);
  assert.match(figure, /<figcaption>Rechenbeispiel: Wächst Pro um 40 %, wächst das Budget für kostenlose Lernangebote um 20 %\.<\/figcaption>/);
  const method = growth.match(/<details class="peak-method">[\s\S]*?<\/details>/)?.[0];
  assert.ok(method);
  assert.match(method, /1\.000 € Pro-Einnahmen und 500 € Free-Budget/);
  assert.match(method, /Das Beispiel ist frei gewählt\.<\/p>/);
  assert.doesNotMatch(growth, /durchspielen|Alle sechs Monate/);
});

test('Free and Pro: the lines draw with the scroll only when motion is allowed', async () => {
  const css = await read('relaunch-sections.css');
  const motion = css.match(/@media \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(motion, /animation-timeline:\s*--growth/);
  assert.match(motion, /stroke-dashoffset/);
  // Outside the motion block the lines are fully drawn.
  assert.doesNotMatch(css.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?\n\}/, ''), /stroke-dashoffset:\s*1/);
});

test('prices: three equal cards keep every amount, the free first presentation and the disclaimer', async () => {
  const plans = section('plaene');
  for (const text of ['9,99 €', '2,99 €', '4,99 €', 'Erste Präsentation kostenlos', 'Geplante Preise zum App-Start', 'Auf dieser Website ist kein Kauf möglich']) {
    assert.ok(plans.includes(text), text);
  }
  assert.equal([...plans.matchAll(/<article class="pricing-card/g)].length, 3);
  assert.match(plans, /<article class="pricing-card pricing-card-pro"/);
  assert.doesNotMatch(plans, /badge|beliebt|empfohlen/i);
  const css = await read('relaunch-sections.css');
  assert.match(css, /\.pricing-card\s*\{[^}]*border-radius:\s*20px/);
  assert.match(css, /\.pricing-card-pro\s*\{[^}]*border-color:\s*var\(--neon\)/);
});

test('the new copy is translated and removed controls leave no stale strings behind', () => {
  assert.equal(en['Rechenbeispiel: Wächst Pro um 40 %, wächst das Budget für kostenlose Lernangebote um 20 %.'],
    'Example calculation: if Pro grows by 40%, the budget for free learning grows by 20%.');
  assert.ok(en['Pro +40 %']);
  assert.ok(en['Free +20 %']);
  assert.ok(en['Mit jedem Pro-Abo wächst unser Spielraum für kostenlose Lernangebote. Ein Rechenbeispiel zeigt, was das bedeuten kann.']);
  const method = Object.keys(en).find(key => key.startsWith('Wir starten im Beispiel'));
  assert.match(method, /Das Beispiel ist frei gewählt\.$/);
  assert.match(en[method], /illustrative/);
  for (const stale of ['Beispielmonat', 'Monat 1', 'Vorheriger Meilenstein', 'Nächster Meilenstein', 'Pro-Einnahmen gegenüber dem Start']) {
    assert.equal(en[stale], undefined, stale);
  }
});

test('stylesheet is linked last in the head; old plate and peak scripts are gone', async () => {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
  const links = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(match => match[1]);
  assert.ok(links.indexOf('relaunch-sections.css') > links.indexOf('relaunch.css'));
  const showcase = await read('showcase.js');
  assert.doesNotMatch(showcase, /peak|additionalRevenue/);
  const storyline = await read('storyline.js');
  assert.doesNotMatch(storyline, /chapter-plate|chapter-controls|scrollTo/);
  assert.match(storyline, /from '\.\/count-up\.js'/);
  const story = await read('story.css');
  assert.doesNotMatch(story, /position:\s*sticky|chapter-plate|chapter-controls/);
});

// A fake page: a list of chapters with movable tops, no browser needed.
function storyHarness({ reduced = false, lang = 'de' } = {}) {
  const classes = () => { const set = new Set(); return { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, on) => (on ? set.add(c) : set.delete(c)) }; };
  const frames = [];
  const tops = [100, 400, 700, 1000, 1300, 1600, 1900, 2200, 2500];
  let offset = 0;
  const count = { dataset: { countTo: '3712' }, textContent: '3.712' };
  const chapters = tops.map((top, i) => ({ classList: classes(), getBoundingClientRect: () => ({ top: top - offset }) }));
  count.closest = () => chapters[6];
  const props = {};
  const list = {
    style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: k => { delete props[k]; } },
    querySelectorAll: () => chapters,
    querySelector: () => count,
    getBoundingClientRect: () => ({ top: 100 - offset, height: 2500 }),
  };
  const attributes = new Set();
  const section = { querySelector: () => list, toggleAttribute: (name, on) => (on ? attributes.add(name) : attributes.delete(name)) };
  const motion = { matches: reduced };
  let now = 0;
  Object.assign(globalThis, {
    document: { querySelector: () => section, documentElement: { lang } },
    matchMedia: () => motion,
    innerHeight: 1000,
    requestAnimationFrame: cb => { frames.push(cb); return frames.length; },
    cancelAnimationFrame: () => { frames.length = 0; },
  });
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
  return {
    count, chapters, props, attributes, motion,
    scrollTo(y) { offset = y; },
    advance(ms) { now += ms; const pending = frames.splice(0); pending.forEach(cb => cb(now)); },
    framesPending: () => frames.length,
  };
}

test('story: chapters light up once, the count runs once from 0 to 3.712 and then rests', async () => {
  const { setupStory } = await import('../public/storyline.js');
  const page = storyHarness();
  const story = setupStory();
  story.measure();
  assert.ok(page.attributes.has('data-story-live'));
  assert.equal(page.count.textContent, '0');
  assert.deepEqual(page.chapters.map(c => c.classList.contains('is-reached')).slice(0, 3), [true, true, false]);
  page.scrollTo(1400); // community chapter top: 1900 - 1400 = 500 < 600
  story.update();
  assert.ok(page.chapters[6].classList.contains('is-reached'));
  page.advance(300);
  const middle = Number(page.count.textContent.replace('.', ''));
  assert.ok(middle > 0 && middle < 3712);
  page.advance(700);
  assert.equal(page.count.textContent, '3.712');
  assert.equal(page.framesPending(), 0, 'no loop keeps running');
  page.scrollTo(0);
  story.update();
  assert.ok(page.chapters[6].classList.contains('is-reached'), 'reached chapters stay bright');
  story.update();
  assert.equal(page.framesPending(), 0, 'the count never starts again');
  assert.equal(page.props['--story-progress'], '0.2000');
});

test('story: reduced motion shows everything at once, in the reader’s language', async () => {
  const { setupStory } = await import('../public/storyline.js');
  const page = storyHarness({ reduced: true, lang: 'en' });
  const story = setupStory();
  story.measure();
  assert.ok(!page.attributes.has('data-story-live'));
  assert.equal(page.count.textContent, '3,712');
  assert.equal(page.framesPending(), 0);
  assert.ok(page.chapters.every(c => !c.classList.contains('is-reached')));
  assert.equal(page.props['--story-progress'], undefined, 'line stays full');
});
