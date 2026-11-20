const query = new URLSearchParams(location.search);
const key = query.get('folge') ?? '';
const valid = /^(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|(?:python|javascript|java|dart)\.(?:basics|control)\.v1|katalog-[a-zA-Z0-9_-]{1,80})$/.test(key);
const status = document.getElementById('status');
if (query.size !== 1 || !valid) {
  document.getElementById('title').textContent = 'Unvollständiger Podcastlink';
  document.getElementById('intro').textContent = 'Bitte lass dir den Link zur Folge noch einmal schicken.';
} else {
  const open = document.getElementById('open');
  open.href = 'mylenova://podcast?folge=' + encodeURIComponent(key);
  open.hidden = false;
  let opened = false;
  open.addEventListener('click', () => { opened = true; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) opened = true;
  });
  try {
    // Only the bundle ID is looked up. The episode link never leaves this page.
    const response = await fetch('/api/podcast-store', { referrerPolicy:'no-referrer' });
    if (!response.ok) throw Error();
    const {url} = await response.json();
    if (typeof url === 'string' && /^https:\/\/apps\.apple\.com\/de\/app\/id\d+$/.test(url)) {
      const store = document.getElementById('store');
      store.href = url;
      store.hidden = false;
      status.textContent = 'Tippe nach der Installation erneut auf den Link in WhatsApp. Damit öffnest du genau diese Folge.';
      const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (appleMobile && !opened && !document.hidden) location.replace(url);
    } else {
      status.textContent = 'Novaire ist noch in der Beta. Mit der aktuellen TestFlight-Version kannst du die Folge öffnen. Nach dem App-Store-Start führt dieser Link auch zum Download.';
    }
  } catch {
    status.textContent = 'Der App Store ist gerade nicht erreichbar. Wenn du Novaire schon hast, kannst du die Folge oben öffnen.';
  }
}
