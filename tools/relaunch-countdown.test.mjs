import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LAUNCH_AT, LAUNCH_START, launchProgress } from '../public/launch-countdown-core.js';
import { createDigitBurst, MAX_PARTICLES, PARTICLE_LIFETIME } from '../public/countdown-particles.js';
import { translate } from '../public/i18n-core.js';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
const banner = async () => (await read('index.html')).match(/<aside class="launch-countdown"[\s\S]*?<\/aside>/)[0];

test('progress runs from the beta start on 7.11. to the release instant, clamped to [0, 1]', () => {
  assert.equal(new Date(LAUNCH_START).toISOString(), '2026-11-06T23:00:00.000Z');
  assert.equal(launchProgress(LAUNCH_START - 1), 0);
  assert.equal(launchProgress(LAUNCH_START - 86400000), 0);
  assert.equal(launchProgress(LAUNCH_START), 0);
  assert.equal(launchProgress((LAUNCH_START + LAUNCH_AT) / 2), 0.5);
  assert.equal(launchProgress(LAUNCH_AT), 1);
  assert.equal(launchProgress(LAUNCH_AT + 86400000), 1);
  assert.equal(launchProgress(5, 10, 10), 1);
  assert.equal(launchProgress(10, 10, 10), 1);
  assert.equal(launchProgress(15, 10, 10), 1);
  for (const now of [NaN, Infinity, -Infinity]) assert.ok(!Number.isNaN(launchProgress(now)));
});

test('the hero countdown has an accessible progress bar with both labels and a particle canvas', async () => {
  const aside = await banner();
  const bar = aside.match(/<[^>]+class="launch-progress"[^>]*>/)?.[0];
  assert.ok(bar, 'progress bar element');
  assert.match(bar, /role="progressbar"/);
  assert.match(bar, /aria-valuemin="0"/);
  assert.match(bar, /aria-valuemax="100"/);
  assert.match(bar, /aria-valuenow="\d+"/);
  assert.match(bar, /aria-label="[^"]+"/);
  assert.match(aside, />Beta-Start 7\.11\.</);
  assert.match(aside, />Release 27\.11\.</);
  assert.ok(aside.indexOf('class="launch-progress"') > aside.indexOf('launch-countdown-date'), 'bar sits under the date line');
  // Without JavaScript the bar would show a stale value: it stays hidden, like the clock.
  assert.match(aside, /data-launch-progress hidden/);
  const canvas = aside.match(/<canvas[^>]*>/)?.[0];
  assert.ok(canvas);
  assert.match(canvas, /class="launch-countdown-burst"/);
  assert.match(canvas, /aria-hidden="true"/);
  assert.ok(aside.indexOf('<canvas') > aside.indexOf('role="timer"'), 'canvas covers the clock');
  assert.ok(aside.indexOf('<canvas') < aside.indexOf('data-launch-arrived'));
  assert.doesNotMatch(aside, /style="/);
});

test('bar labels and the bar name have English entries next to the countdown entries', async () => {
  assert.equal(translate('Beta-Start 7.11.', 'en'), 'Beta start 7 Nov');
  assert.equal(translate('Release 27.11.', 'en'), 'Release 27 Nov');
  const label = (await banner()).match(/class="launch-progress"[^>]*aria-label="([^"]+)"/)?.[1]
    || (await banner()).match(/aria-label="([^"]+)"[^>]*class="launch-progress"/)?.[1];
  assert.notEqual(translate(label, 'en'), label);
  const source = await read('translations-en.js');
  const anchor = source.indexOf("'Der Launch-Tag ist da.'");
  for (const key of ["'Beta-Start 7.11.'", "'Release 27.11.'"]) {
    const at = source.indexOf(key);
    assert.ok(at > anchor && at - anchor < 300, `${key} sits right after the countdown entries`);
  }
});

test('countdown styles: green fill with tip glow, no clipping container, reduced motion is static', async () => {
  const css = await read('launch-countdown.css');
  const block = (selector) => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
  assert.doesNotMatch(block('.launch-countdown'), /overflow:\s*hidden/, 'no glow inside overflow hidden');
  assert.doesNotMatch(block('.launch-progress'), /overflow:\s*hidden/);
  assert.match(block('.launch-progress'), /height:\s*4px/);
  assert.match(block('.launch-progress-fill'), /var\(--neon/);
  assert.match(block('.launch-progress-fill'), /var\(--launch-progress/);
  assert.match(block('.launch-progress-fill::after'), /box-shadow/);
  assert.match(block('.launch-countdown-burst'), /pointer-events:\s*none/);
  assert.doesNotMatch(css, /italic|serif["';\s]|cubic-bezier\([^)]*,\s*1\.[0-9]|cubic-bezier\([^)]*-\s*0?\./i, 'no serif, italic, bounce or overshoot');
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(reduced, /launch-countdown-burst[^}]*display:\s*none/);
  // The fill runs in once through the script; a CSS transition would restart every second.
  assert.doesNotMatch(block('.launch-progress-fill'), /transition/);
});

function fakeContext(log) {
  return {
    font: '', fillStyle: '', globalAlpha: 1, textAlign: '', textBaseline: '', letterSpacing: '0px',
    setTransform() {}, clearRect() { log.clears += 1; }, fillRect() { log.rects += 1; }, fillText() { log.texts += 1; },
    measureText: () => ({ width: 40, fontBoundingBoxAscent: 64, fontBoundingBoxDescent: 16 }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) }),
  };
}
function fakeEnv() {
  const log = { clears: 0, rects: 0, texts: 0, requested: 0, cancelled: [], scratch: 0 };
  const queue = new Map();
  let nextId = 1;
  const canvas = { clientWidth: 480, clientHeight: 140, width: 0, height: 0, getContext: () => fakeContext(log) };
  const env = {
    devicePixelRatio: 3,
    requestAnimationFrame(callback) { log.requested += 1; const id = nextId++; queue.set(id, callback); return id; },
    cancelAnimationFrame(id) { log.cancelled.push(id); queue.delete(id); },
    createCanvas(w, h) { log.scratch += 1; return { width: w, height: h, getContext: () => fakeContext(log) }; },
  };
  // Run queued frames at 60 Hz until nothing is requested any more; returns elapsed ms.
  const drain = (limit = 5000) => {
    let time = 0;
    while (queue.size && time < limit) {
      const [[id, callback]] = queue; queue.delete(id);
      time += 16; callback(time);
    }
    return time;
  };
  return { canvas, env, log, queue, drain };
}
const rect = { x: 300, y: 32, width: 120, height: 72 };

test('reduced motion: burst does nothing and never requests a frame', () => {
  const { canvas, env, log } = fakeEnv();
  const burster = createDigitBurst(canvas, { reducedMotion: true }, env);
  assert.equal(typeof burster.burst, 'function');
  assert.equal(typeof burster.stop, 'function');
  burster.burst('42', rect, '400 72px sans-serif', '#f4f6fa');
  burster.stop();
  assert.equal(log.requested, 0);
  assert.equal(log.scratch, 0);
  // A live preference (function) is honoured per call as well.
  let reduce = true;
  const live = createDigitBurst(canvas, { reducedMotion: () => reduce }, env);
  live.burst('42', rect, '400 72px sans-serif', '#f4f6fa');
  assert.equal(log.requested, 0);
  reduce = false;
  live.burst('42', rect, '400 72px sans-serif', '#f4f6fa');
  assert.equal(log.requested, 1);
  live.stop();
});

test('a burst releases at most the cap, lives 700 ms and then stops its loop', () => {
  assert.equal(MAX_PARTICLES, 220);
  assert.equal(PARTICLE_LIFETIME, 700);
  const { canvas, env, log, drain } = fakeEnv();
  const burster = createDigitBurst(canvas, { reducedMotion: false }, env);
  const released = burster.burst('59', rect, '400 72px sans-serif', '#f4f6fa');
  assert.ok(released > 0 && released <= MAX_PARTICLES, `released ${released}`);
  assert.equal(log.requested, 1, 'one loop per burst, not one per particle');
  assert.equal(canvas.width, 960, 'pixel ratio capped at 2');
  assert.equal(canvas.height, 280);
  const elapsed = drain();
  assert.ok(elapsed >= PARTICLE_LIFETIME && elapsed <= PARTICLE_LIFETIME + 48, `loop ran ${elapsed} ms`);
  assert.ok(log.rects > 0);
  const requested = log.requested;
  drain();
  assert.equal(log.requested, requested, 'nothing alive, no new frames');
  // The glyph sampling of a repeated text is cached and the scratch canvas reused.
  burster.burst('59', rect, '400 72px sans-serif', '#f4f6fa');
  burster.burst('58', rect, '400 72px sans-serif', '#f4f6fa');
  assert.equal(log.scratch, 1);
  burster.stop();
});

test('phones get half the cap; simultaneous bursts share one loop; stop cancels it at once', () => {
  const { canvas, env, log, queue } = fakeEnv();
  const burster = createDigitBurst(canvas, { reducedMotion: false, maxParticles: () => MAX_PARTICLES / 2 }, env);
  assert.ok(burster.burst('07', rect, '400 48px sans-serif', '#f4f6fa') <= MAX_PARTICLES / 2);
  assert.ok(burster.burst('08', { ...rect, x: 100 }, '400 48px sans-serif', '#f4f6fa') <= MAX_PARTICLES / 2);
  assert.equal(log.requested, 1);
  assert.equal(queue.size, 1);
  const [pending] = queue.keys();
  burster.stop();
  assert.deepEqual(log.cancelled, [pending]);
  assert.equal(queue.size, 0);
  // Never more than the hard cap, whatever the caller asks for.
  const greedy = createDigitBurst(canvas, { maxParticles: 10000 }, env);
  assert.ok(greedy.burst('88', rect, '400 72px sans-serif', '#fff') <= MAX_PARTICLES);
  greedy.stop();
  // Empty text or a missing 2D context is a harmless no-op.
  const blind = createDigitBurst({ clientWidth: 10, clientHeight: 10, getContext: () => null }, {}, env);
  assert.equal(blind.burst('12', rect, '400 72px sans-serif', '#fff'), 0);
  assert.equal(burster.burst('', rect, '400 72px sans-serif', '#fff'), 0);
});

// --- launch-countdown.js against a small fake DOM ---------------------------------------------

function element(extra = {}) {
  const attributes = {};
  const properties = {};
  return {
    hidden: false, textContent: '', dataset: {},
    style: { setProperty(name, value) { properties[name] = value; } },
    properties,
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return attributes[name] ?? null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 140 }),
    animate() { return { cancel() {} }; },
    getAnimations: () => [],
    get offsetWidth() { return 480; },
    attributes,
    ...extra,
  };
}

async function runCountdown(now, { reducedMotion = false } = {}) {
  const units = ['days', 'hours', 'minutes', 'seconds'].map((unit, index) => {
    const value = element({ getBoundingClientRect: () => ({ left: 20 + index * 120, top: 40, width: 100, height: 72 }) });
    value.dataset.launchUnit = unit;
    value.textContent = '—';
    return value;
  });
  const frames = { requested: 0, cancelled: 0, pending: new Map(), nextId: 1 };
  const listeners = {};
  const nodes = {
    '[role="timer"]': element({ hidden: true }),
    '[data-launch-status]': element(),
    '[data-launch-arrived]': element({ hidden: true }),
    '[data-launch-progress]': element({ hidden: true }),
    '[role="progressbar"]': element(),
    '.launch-countdown-burst': element({ clientWidth: 480, clientHeight: 172, width: 0, height: 0, getContext: () => fakeContext({ clears: 0, rects: 0, texts: 0 }) }),
  };
  const root = element({
    querySelector: (selector) => nodes[selector] ?? null,
    querySelectorAll: (selector) => selector === '[data-launch-unit]' ? units : [],
  });
  const timers = [];
  const saved = {};
  const globals = {
    document: {
      hidden: false,
      querySelector: (selector) => selector === '[data-launch-countdown]' ? root : null,
      addEventListener: (type, callback) => { listeners[type] = callback; },
      createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext({ clears: 0, rects: 0, texts: 0 }) }),
    },
    window: { addEventListener: (type, callback) => { listeners[`window:${type}`] = callback; } },
    matchMedia: (query) => ({ matches: query.includes('reduced-motion') ? reducedMotion : false, addEventListener() {} }),
    getComputedStyle: () => ({ fontWeight: '400', fontSize: '72px', fontFamily: 'sans-serif', color: 'rgb(244, 246, 250)', letterSpacing: '-3.96px' }),
    requestAnimationFrame: (callback) => { frames.requested += 1; const id = frames.nextId++; frames.pending.set(id, callback); return id; },
    cancelAnimationFrame: (id) => { frames.cancelled += 1; frames.pending.delete(id); },
    devicePixelRatio: 2,
    OffscreenCanvas: undefined,
    setTimeout: (callback, ms) => { timers.push(ms); return timers.length; },
    clearTimeout: () => {},
  };
  for (const key of Object.keys(globals)) { saved[key] = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { value: globals[key], configurable: true, writable: true }); }
  const realNow = Date.now;
  let clock = now;
  Date.now = () => clock;
  const restore = () => {
    Date.now = realNow;
    for (const key of Object.keys(globals)) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key];
    }
  };
  try {
    await import(`../public/launch-countdown.js?run=${Math.random()}`);
  } catch (error) { restore(); throw error; }
  return {
    units, nodes, root, frames, timers, globals, restore,
    advance(ms) { clock += ms; listeners.visibilitychange(); },
    setTime(ms) { clock = ms; listeners.visibilitychange(); },
  };
}

test('after the launch instant: arrived state, full bar, no frames and no timers', async () => {
  const page = await runCountdown(LAUNCH_AT + 5000);
  try {
    assert.equal(page.nodes['[role="timer"]'].hidden, true);
    assert.equal(page.nodes['[data-launch-arrived]'].hidden, false);
    assert.equal(page.root.dataset.state, 'arrived');
    assert.equal(page.nodes['[data-launch-progress]'].hidden, false);
    assert.equal(Number(page.nodes['[role="progressbar"]'].properties['--launch-progress']), 1);
    assert.equal(page.nodes['[role="progressbar"]'].getAttribute('aria-valuenow'), '100');
    assert.equal(page.frames.requested, 0);
    assert.equal(page.timers.length, 0);
  } finally { page.restore(); }
});

test('each changed unit dissolves into particles, the loop stops at launch and when the tab hides', async () => {
  const page = await runCountdown(LAUNCH_AT - 3000);
  try {
    const seconds = page.units[3];
    assert.equal(seconds.textContent, '03');
    assert.equal(page.frames.requested, 0, 'first paint without a burst');
    const progress = page.nodes['[role="progressbar"]'];
    const value = Number(progress.properties['--launch-progress']);
    assert.ok(value > 0.99 && value < 1);
    assert.equal(progress.getAttribute('aria-valuenow'), '99');
    page.advance(1000);
    assert.equal(seconds.textContent, '02', 'DOM text stays the real value');
    assert.equal(page.frames.requested, 1, 'old digits burst');
    page.globals.document.hidden = true;
    page.advance(0);
    assert.equal(page.frames.pending.size, 0, 'hidden tab cancels the loop');
    page.globals.document.hidden = false;
    page.advance(1000);
    assert.equal(page.frames.pending.size, 1);
    page.setTime(LAUNCH_AT);
    assert.equal(page.frames.pending.size, 0, 'launch stops the loop');
    assert.equal(page.root.dataset.state, 'arrived');
    assert.equal(progress.getAttribute('aria-valuenow'), '100');
    const requested = page.frames.requested;
    page.advance(1000);
    assert.equal(page.frames.requested, requested);
  } finally { page.restore(); }
});

test('reduced motion: digits change without particles or frames', async () => {
  const page = await runCountdown(LAUNCH_AT - 3000, { reducedMotion: true });
  try {
    page.advance(1000);
    assert.equal(page.units[3].textContent, '02');
    assert.equal(page.frames.requested, 0);
  } finally { page.restore(); }
});

test('the countdown script wires visibility, viewport and the particle module', async () => {
  const script = await read('launch-countdown.js');
  assert.match(script, /from '\.\/countdown-particles\.js'/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /visibilitychange/);
  assert.match(script, /launchProgress\(/);
  assert.match(script, /aria-valuenow/);
  assert.match(script, /max-width: 699px/);
  const particles = await read('countdown-particles.js');
  assert.match(particles, /Math\.min\(2,/);
  assert.doesNotMatch(particles, /\bfetch\(|localStorage|innerHTML/);
});
