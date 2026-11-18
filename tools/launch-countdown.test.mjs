import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LAUNCH_AT, launchTimeRemaining } from '../public/launch-countdown-core.js';
import { translate } from '../public/i18n-core.js';

test('launch is November 27 at 18:00 Berlin / 17:00 UTC, independent of browser timezone', () => {
  assert.equal(new Date(LAUNCH_AT).toISOString(), '2026-11-27T17:00:00.000Z');
  assert.deepEqual(launchTimeRemaining(Date.parse('2026-11-16T17:00:00Z')),
    { days: 11, hours: 0, minutes: 0, seconds: 0, ended: false });
  assert.deepEqual(launchTimeRemaining(LAUNCH_AT - 90061000),
    { days: 1, hours: 1, minutes: 1, seconds: 1, ended: false });
});

test('never shows negative time and does not declare launch early', () => {
  assert.equal(launchTimeRemaining(LAUNCH_AT - 1).seconds, 1);
  assert.equal(launchTimeRemaining(LAUNCH_AT - 1).ended, false);
  for (const now of [LAUNCH_AT, LAUNCH_AT + 1, LAUNCH_AT + 86400000]) {
    assert.deepEqual(launchTimeRemaining(now), { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
  }
});

test('landing integrates the accessible countdown into the hero, below the product introduction', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /class="hero-copy"[\s\S]*?data-launch-countdown/);
  assert.ok(html.indexOf('data-launch-countdown') > html.indexOf('<header'));
  assert.ok(hero.indexOf('data-launch-countdown') > hero.indexOf('hero-description'));
  assert.ok(hero.indexOf('data-launch-countdown') < hero.indexOf('hero-explore-links'));
  assert.equal((html.match(/data-launch-countdown/g) || []).length, 1);
  assert.match(html, /datetime="2026-11-27T18:00:00\+01:00"/);
  assert.match(html, /role="timer" aria-live="off"/);
  assert.equal((html.match(/data-launch-unit=/g) || []).length, 4);
  assert.match(html, /href="launch-countdown.css"/);
  assert.match(html, /type="module" src="launch-countdown.js"/);
});

test('all launch copy translates and the timer has no external dependencies or tracking', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const banner = html.match(/<aside class="launch-countdown"[\s\S]*?<\/aside>/)[0];
  for (const [, source] of banner.matchAll(/>([^<>]+)</g)) {
    const text = source.trim();
    if (!text || ['—', ':'].includes(text)) continue;
    assert.notEqual(translate(text, 'en'), text, `Missing translation: ${text}`);
  }
  const script = await readFile(new URL('../public/launch-countdown.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /\bfetch\(|localStorage|sessionStorage|innerHTML/);
  assert.match(script, /visibilitychange/);
  assert.match(script, /prefers-reduced-motion/);
});
