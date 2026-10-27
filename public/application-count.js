import { getLanguage, t } from './i18n.js';

// Only a public aggregate is requested. No API key, cookies, applicant data,
// browser storage, user identifier or analytics event is involved.
const COUNT_URL = 'https://naafzrrhjsfaqqrnhrcn.supabase.co/functions/v1/beta-application/count';
const REFRESH_MS = 60_000;
const TIMEOUT_MS = 5_000;
const STALE_MS = 150_000;

for (const element of document.querySelectorAll('[data-application-counter]')) {
  const value = element.querySelector('[data-count-value]');
  const status = element.querySelector('[data-count-status]');
  const badge = element.querySelector('[data-count-badge]');
  if (!value || !status || !badge) continue;

  let snapshot = null;
  let failed = false;
  let suspended = false;
  let timer = null;
  let controller = null;
  let lastStarted = 0;

  function render() {
    const locale = getLanguage() === 'en' ? 'en-GB' : 'de-DE';
    const stale = snapshot && (failed || Date.now() - snapshot.updatedAt.getTime() > STALE_MS);
    element.dataset.state = failed ? 'unavailable' : stale ? 'stale' : snapshot ? 'ready' : 'loading';
    const nextValue = snapshot ? new Intl.NumberFormat(locale).format(snapshot.count) : '—';
    // Avoid repeating an unchanged number to screen readers on each refresh.
    if (value.textContent !== nextValue) value.textContent = nextValue;
    badge.textContent = t(snapshot && !stale ? 'LIVE' : 'BETA');

    if (!snapshot) {
      status.textContent = t(failed ? 'Anzahl gerade nicht verfügbar. Wir versuchen es erneut.' : 'Die aktuelle Anzahl wird geladen …');
      return;
    }
    const checkedAt = new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(snapshot.updatedAt);
    status.textContent = `${t('Stand:')} ${checkedAt} · ${t(stale ? 'Aktualisierung ausstehend' : 'Wird jede Minute aktualisiert')}`;
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function canRefresh() {
    return !suspended && document.visibilityState !== 'hidden';
  }

  function schedule() {
    clearTimer();
    if (!canRefresh()) return;
    timer = setTimeout(refresh, Math.max(0, REFRESH_MS - (Date.now() - lastStarted)));
  }

  async function refresh() {
    clearTimer();
    if (!canRefresh() || controller) return;
    lastStarted = Date.now();
    controller = new AbortController();
    const requestController = controller;
    const timeout = setTimeout(() => requestController.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(COUNT_URL, {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        signal: requestController.signal,
      });
      if (!response.ok) throw new Error('Count unavailable');
      const result = await response.json();
      const updatedAt = typeof result?.updatedAt === 'string' ? new Date(result.updatedAt) : null;
      if (!Number.isSafeInteger(result?.count) || result.count < 0 ||
          !updatedAt || !Number.isFinite(updatedAt.getTime()) ||
          updatedAt.getTime() > Date.now() + 5 * 60_000) {
        throw new Error('Invalid aggregate response');
      }
      if (requestController.signal.aborted || !canRefresh()) return;
      snapshot = { count: result.count, updatedAt };
      failed = false;
    } catch {
      // Keep the last successfully received value and label it as out of date.
      // A missing response is never presented as zero or as available places.
      if (canRefresh()) failed = true;
    } finally {
      clearTimeout(timeout);
      if (controller === requestController) controller = null;
      render();
      schedule();
    }
  }

  document.addEventListener('novaire:languagechange', render);
  document.addEventListener('visibilitychange', () => {
    if (!canRefresh()) {
      clearTimer();
      controller?.abort();
    } else {
      render();
      schedule();
    }
  });
  window.addEventListener('pagehide', () => {
    suspended = true;
    clearTimer();
    controller?.abort();
  });
  window.addEventListener('pageshow', () => {
    suspended = false;
    render();
    schedule();
  });
  render();
  if (canRefresh()) void refresh();
}
