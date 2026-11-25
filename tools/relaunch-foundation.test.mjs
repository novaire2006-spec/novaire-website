import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../public/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('relaunch.css', root), 'utf8').catch(() => '');

// One marker per section, in the order the page now tells its story.
const order = [
  ['hero', '<section class="hero"'],
  ['#entdecken', 'id="entdecken"'],
  ['#features', 'id="features"'],
  ['#app-in-aktion', 'id="app-in-aktion"'],
  ['.onboarding-section', 'class="section onboarding-section"'],
  ['.learning-section', 'class="section learning-section"'],
  ['#belohnungen', 'id="belohnungen"'],
  ['#intelligenz', 'id="intelligenz"'],
  ['#anbieter', 'id="anbieter"'],
  ['#free-pro', 'id="free-pro"'],
  ['#plaene', 'id="plaene"'],
  ['#geschichte', 'id="geschichte"'],
  ['#updates', 'id="updates"'],
  ['.beta-invitation', 'class="section beta-invitation'],
  ['#community', 'id="community"'],
  ['#start', 'id="start"'],
];

test('sections inside <main> follow the relaunch order', () => {
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.ok(main.length > 0, 'main exists');
  const positions = order.map(([name, marker]) => {
    const at = main.indexOf(marker);
    assert.ok(at > -1, `missing section ${name}`);
    assert.equal(main.indexOf(marker, at + 1), -1, `section ${name} appears once`);
    return at;
  });
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index] > positions[index - 1], `${order[index][0]} comes after ${order[index - 1][0]}`);
  }
  assert.equal((main.match(/<section\b/g) ?? []).length, order.length, 'no section left out of the order');
});

test('the hero points down to the first section', () => {
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(hero, /<a class="text-link" href="#entdecken">Entdecke Novaire <span aria-hidden="true">↓<\/span><\/a>/);
});

test('relaunch.css is linked as the top layer after story.css', () => {
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(match => match[1]);
  assert.ok(links.includes('story.css'));
  // Feature styles of Tasks 2–5 may follow it; every older stylesheet comes before it.
  for (const older of ['styles.css', 'evolution.css', 'locale.css', 'premium.css', 'launch-countdown.css', 'showcase.css', 'navigation.css', 'story.css']) {
    if (links.includes(older)) assert.ok(links.indexOf(older) < links.indexOf('relaunch.css'), `${older} comes before relaunch.css`);
  }
  assert.ok(links.indexOf('relaunch.css') > links.indexOf('story.css'));
});

test('Inter is embedded locally as a swap font face', () => {
  const face = css.match(/@font-face\s*\{[^}]*\}/)?.[0];
  assert.ok(face, '@font-face present');
  assert.match(face, /font-family:\s*"Inter"/);
  assert.match(face, /src:\s*url\(["']?fonts\/inter-latin-var\.woff2["']?\)/);
  assert.match(face, /font-display:\s*swap/);
  assert.match(face, /font-weight:\s*100 900/);
  assert.match(face, /unicode-range:/);
  assert.doesNotMatch(css, /https?:\/\/|@import/);
});

test('the Apple system face comes first, Inter covers everything else', () => {
  const stack = css.match(/--font-apple:\s*([^;]+);/)?.[1];
  assert.ok(stack, '--font-apple defined');
  assert.ok(stack.startsWith('-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter"'), stack);
  assert.match(css, /--flow-gap:/);
  assert.match(css, /--ease-out:\s*cubic-bezier\(\.22,\s*\.61,\s*\.36,\s*1\)/);
  assert.match(css, /body\s*\{[^}]*font-family:\s*var\(--font-apple\)/);
});

test('the flow uses scroll timelines only behind @supports and never under reduced motion', () => {
  assert.match(css, /@supports\s*\(animation-timeline:\s*view\(\)\)/);
  const timeline = css.indexOf('animation-timeline: view()', css.indexOf('@supports'));
  assert.ok(timeline > -1);
  const before = css.slice(0, timeline);
  assert.ok(before.lastIndexOf('prefers-reduced-motion: no-preference') > -1, 'scroll timeline sits inside a no-preference block');
  assert.doesNotMatch(css, /cubic-bezier\([^)]*,\s*1\.\d|cubic-bezier\([^)]*-\d/, 'no overshoot easing');
  assert.doesNotMatch(css, /font-style:\s*italic|(?<![\w-])serif\b/i);
});

test('the embedded font file exists and is a real woff2', async () => {
  const file = new URL('fonts/inter-latin-var.woff2', root);
  const info = await stat(file);
  assert.ok(info.size > 20 * 1024, `font is ${info.size} bytes`);
  const bytes = await readFile(file);
  assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2');
  const licence = await readFile(new URL('fonts/OFL.txt', root), 'utf8');
  assert.match(licence, /SIL Open Font License/);
});

test('the landing page has no inline style attributes', () => {
  assert.doesNotMatch(html, /\sstyle="/);
});
