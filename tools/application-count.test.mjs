import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { translate } from '../public/i18n-core.js';

// Execute the actual browser module. Only its DOM-backed locale import is
// replaced with a controllable test adapter; no counter logic is duplicated.
const moduleSource = await readFile(new URL('../public/application-count.js', import.meta.url), 'utf8');
const localeImport = "import { getLanguage, t } from './i18n.js';";
assert.ok(moduleSource.startsWith(localeImport), 'Review the harness when the browser module imports change.');
const executableSource = moduleSource.slice(localeImport.length);
const START = Date.parse('2026-10-27T18:00:00Z');
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function textElement(initial = '') {
  let text = initial;
  let writes = 0;
  return {
    get textContent() { return text; },
    set textContent(next) { text = next; writes++; },
    get writes() { return writes; },
  };
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
    },
    dispatch(name) {
      for (const listener of listeners.get(name) ?? []) listener({ type: name });
    },
  };
}

async function createHarness({ responses = [], visibility = 'visible', language = 'de' } = {}) {
  let now = START;
  let currentLanguage = language;
  let nextTimer = 0;
  const timers = new Map();
  const responseQueue = [...responses];
  const requests = [];
  const value = textElement('—');
  const status = textElement();
  const badge = textElement();
  const element = {
    dataset: {},
    querySelector(selector) {
      return {
        '[data-count-value]': value,
        '[data-count-status]': status,
        '[data-count-badge]': badge,
      }[selector] ?? null;
    },
  };
  const document = {
    ...eventTarget(),
    visibilityState: visibility,
    querySelectorAll(selector) {
      assert.equal(selector, '[data-application-counter]');
      return [element];
    },
  };
  const window = eventTarget();

  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }

  const context = vm.createContext({
    document,
    window,
    Date: FakeDate,
    Intl,
    AbortController,
    getLanguage: () => currentLanguage,
    t: (text) => translate(text, currentLanguage),
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + Math.max(0, delay) });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) {
      const plan = responseQueue.shift() ?? {};
      const record = { url, options, startedAt: now, aborted: false };
      requests.push(record);
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          record.aborted = true;
          reject(new DOMException('Synthetic request aborted', 'AbortError'));
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
        if (plan.pending) return;
        options.signal.removeEventListener('abort', onAbort);
        if (plan.networkError) { reject(new Error('Synthetic network failure')); return; }
        const statusCode = plan.status ?? 200;
        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          json: () => plan.invalidJson
            ? Promise.reject(new Error('Synthetic invalid JSON'))
            : Promise.resolve(plan.body ?? { count: 3006, updatedAt: new Date(now).toISOString() }),
        });
      });
    },
  });
  vm.runInContext(executableSource, context, { filename: 'public/application-count.js', timeout: 1000 });
  await flushPromises();

  async function advance(ms) {
    const target = now + ms;
    let callbacks = 0;
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++callbacks < 1000, 'Counter must not spin in an immediate timer loop.');
      timers.delete(next[0]);
      now = next[1].at;
      // Do not await a pending network request; deliver its later timeout too.
      next[1].callback();
      await flushPromises();
    }
    now = target;
    await flushPromises();
  }

  return {
    element, value, status, badge, requests, timers, advance,
    async language(next) {
      currentLanguage = next;
      document.dispatch('novaire:languagechange');
      await flushPromises();
    },
    async visibility(next) {
      document.visibilityState = next;
      document.dispatch('visibilitychange');
      await flushPromises();
    },
    async pageEvent(name) {
      window.dispatch(name);
      await flushPromises();
    },
  };
}

test('successful aggregate uses only the public endpoint and refreshes no faster than once a minute', async () => {
  const h = await createHarness();
  assert.equal(h.value.textContent, '3.006');
  assert.equal(h.element.dataset.state, 'ready');
  assert.equal(h.badge.textContent, 'LIVE');
  assert.match(h.status.textContent, /Wird jede Minute aktualisiert/);
  assert.equal(h.requests.length, 1);
  const { url, options } = h.requests[0];
  assert.equal(url, 'https://naafzrrhjsfaqqrnhrcn.supabase.co/functions/v1/beta-application/count');
  assert.equal(options.method, 'GET');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.headers, undefined);
  assert.equal(options.body, undefined);
  assert.ok(options.signal instanceof AbortSignal);
  await h.advance(59_999);
  assert.equal(h.requests.length, 1);
  await h.advance(1);
  assert.equal(h.requests.length, 2);
  assert.equal(h.value.writes, 1, 'An unchanged total must not be re-announced each minute.');
});

test('a genuine zero from a valid successful aggregate is rendered as zero', async () => {
  const h = await createHarness({ responses: [{ body: { count: 0, updatedAt: new Date(START).toISOString() } }] });
  assert.equal(h.value.textContent, '0');
  assert.equal(h.element.dataset.state, 'ready');
  assert.equal(h.badge.textContent, 'LIVE');
});

test('a subsequent successful poll replaces the displayed count with the new exact total', async () => {
  const h = await createHarness({ responses: [
    { body: { count: 3006, updatedAt: new Date(START).toISOString() } },
    { body: { count: 3012, updatedAt: new Date(START + 60_000).toISOString() } },
  ] });
  await h.advance(60_000);
  assert.equal(h.value.textContent, '3.012');
  assert.equal(h.value.writes, 2);
  assert.equal(h.element.dataset.state, 'ready');
  assert.equal(h.requests.length, 2);
});

test('an initial 503 is unavailable rather than a fabricated zero and automatically retries', async () => {
  const h = await createHarness({ responses: [{ status: 503 }] });
  assert.equal(h.value.textContent, '—');
  assert.equal(h.element.dataset.state, 'unavailable');
  assert.equal(h.badge.textContent, 'BETA');
  assert.match(h.status.textContent, /Anzahl gerade nicht verfügbar/);
  await h.advance(60_000);
  assert.equal(h.requests.length, 2);
  assert.equal(h.value.textContent, '3.006');
  assert.equal(h.element.dataset.state, 'ready');
});

test('failed refresh preserves the last verified total and explicitly marks it out of date', async () => {
  const h = await createHarness({ responses: [{}, { status: 503 }] });
  await h.advance(60_000);
  assert.equal(h.value.textContent, '3.006');
  assert.equal(h.value.writes, 1);
  assert.equal(h.element.dataset.state, 'unavailable');
  assert.equal(h.badge.textContent, 'BETA');
  assert.match(h.status.textContent, /Stand:/);
  assert.match(h.status.textContent, /Aktualisierung ausstehend/);
  assert.doesNotMatch(h.status.textContent, /Wird jede Minute aktualisiert/);
});

test('an already old server snapshot is shown as stale, not labelled LIVE', async () => {
  const h = await createHarness({ responses: [{ body: { count: 2900, updatedAt: new Date(START - 180_000).toISOString() } }] });
  assert.equal(h.value.textContent, '2.900');
  assert.equal(h.element.dataset.state, 'stale');
  assert.equal(h.badge.textContent, 'BETA');
  assert.match(h.status.textContent, /Aktualisierung ausstehend/);
});

test('DE/EN changes reformat the counter and labels without an extra request', async () => {
  const h = await createHarness();
  await h.language('en');
  assert.equal(h.value.textContent, '3,006');
  assert.ok(h.status.textContent.includes(translate('Stand:', 'en')));
  assert.ok(h.status.textContent.includes(translate('Wird jede Minute aktualisiert', 'en')));
  await h.language('de');
  assert.equal(h.value.textContent, '3.006');
  assert.equal(h.requests.length, 1);
  assert.equal(h.element.dataset.state, 'ready');
});

test('an initially hidden page makes no request until it becomes visible', async () => {
  const h = await createHarness({ visibility: 'hidden' });
  assert.equal(h.requests.length, 0);
  assert.equal(h.timers.size, 0);
  await h.advance(120_000);
  assert.equal(h.requests.length, 0);
  await h.visibility('visible');
  await h.advance(0);
  assert.equal(h.requests.length, 1);
  assert.equal(h.element.dataset.state, 'ready');
});

test('hiding the page aborts its pending request, stops polling and resumes safely', async () => {
  const h = await createHarness({ responses: [{ pending: true }] });
  await h.advance(1000);
  await h.visibility('hidden');
  assert.equal(h.requests[0].aborted, true);
  assert.equal(h.value.textContent, '—');
  assert.equal(h.timers.size, 0);
  await h.advance(120_000);
  assert.equal(h.requests.length, 1);
  await h.visibility('visible');
  await h.advance(0);
  assert.equal(h.requests.length, 2);
  assert.equal(h.value.textContent, '3.006');
  assert.equal(h.element.dataset.state, 'ready');
});

test('a five-second request timeout clears loading and retries at the minute boundary', async () => {
  const h = await createHarness({ responses: [{ pending: true }] });
  await h.advance(4999);
  assert.equal(h.requests[0].aborted, false);
  assert.equal(h.element.dataset.state, 'loading');
  await h.advance(1);
  assert.equal(h.requests[0].aborted, true);
  assert.equal(h.element.dataset.state, 'unavailable');
  assert.equal(h.value.textContent, '—');
  await h.advance(54_999);
  assert.equal(h.requests.length, 1);
  await h.advance(1);
  assert.equal(h.requests.length, 2);
  assert.equal(h.element.dataset.state, 'ready');
});

test('pagehide/pageshow suspends polling and recovers after browser back-forward cache restore', async () => {
  const h = await createHarness({ responses: [{ pending: true }] });
  await h.pageEvent('pagehide');
  assert.equal(h.requests[0].aborted, true);
  assert.equal(h.timers.size, 0);
  await h.advance(70_000);
  assert.equal(h.requests.length, 1);
  await h.pageEvent('pageshow');
  await h.advance(0);
  assert.equal(h.requests.length, 2);
  assert.equal(h.element.dataset.state, 'ready');
});

test('malformed counts, dates, JSON and network errors never become a successful aggregate', async () => {
  const date = new Date(START).toISOString();
  const responses = [
    { body: { count: -1, updatedAt: date } },
    { body: { count: '0', updatedAt: date } },
    { body: { count: 0.5, updatedAt: date } },
    { body: { count: Number.MAX_SAFE_INTEGER + 1, updatedAt: date } },
    { body: { count: Infinity, updatedAt: date } },
    { body: { count: 123, updatedAt: 'not a date' } },
    { body: { count: 123, updatedAt: new Date(START + 6 * 60_000).toISOString() } },
    { body: {} },
    { invalidJson: true },
    { networkError: true },
  ];
  for (const response of responses) {
    const h = await createHarness({ responses: [response] });
    assert.equal(h.value.textContent, '—');
    assert.equal(h.element.dataset.state, 'unavailable');
    assert.equal(h.badge.textContent, 'BETA');
  }
});
