// Admin dashboard (owner 27.11.2026). The session token lives only in this
// module; reloading the page means signing in again. Everything shown comes
// from admin_dashboard_* functions that check the admin role on the server.
import { signIn, callRpc, trafficLight, euro, usd, pct, int, EUR_PER_USD } from './admin-core.js';

const $ = (id) => document.getElementById(id);
let session = null;
let timer = null;
let fetchImpl = (...args) => fetch(...args);

// Fake numbers for looking at the layout, only on this computer.
const demo = location.hostname === '127.0.0.1' && new URLSearchParams(location.search).has('demo');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    // CSSOM, not the style attribute: the page's CSP has no 'unsafe-inline'.
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c);
  return node;
}
const fill = (id, ...children) => $(id).replaceChildren(...children.flat());
const row = (label, value, note) => el('div', { class: 'row' },
  el('span', { text: label }), el('strong', { text: value }), note ? el('span', { class: 'note', text: note }) : null);
const empty = (text) => el('p', { class: 'empty', text });

function show(view) {
  $('login').hidden = view !== 'login';
  $('board').hidden = view !== 'board';
}

function loginError(text) {
  const p = $('login-error');
  p.textContent = text; p.hidden = !text;
}

function boardError(text) {
  const p = $('board-error');
  p.textContent = text; p.hidden = !text;
}

function logout(message = '') {
  session = null;
  clearInterval(timer); timer = null;
  $('password').value = '';
  // Nothing of the last session stays in the page.
  for (const id of ['kpis', 'series', 'money', 'retention', 'business', 'errors', 'feedback']) $(id).replaceChildren();
  $('light-text').textContent = 'Lädt …';
  delete $('light').dataset.level;
  boardError('');
  show('login');
  loginError(message);
}

async function load() {
  if (!session) return false;
  if (Date.now() > session.expiresAt - 30_000) { logout('Bitte melde dich neu an.'); return false; }
  const started = session;
  const rpc = (name, params) => callRpc(fetchImpl, started.token, name, params);
  try {
    const [overview, business, errors, feedback] = await Promise.all([
      rpc('admin_dashboard_overview'),
      rpc('admin_dashboard_business'),
      rpc('admin_dashboard_errors', { p_days: 7 }),
      rpc('admin_dashboard_feedback', { p_limit: 20 }),
    ]);
    // Signed out (or someone else signed in) while this was loading.
    if (session !== started) return false;
    boardError('');
    render({ overview, business, errors, feedback });
    return true;
  } catch (e) {
    if (session !== started) return false;
    if (e.message === 'expired') { logout('Bitte melde dich neu an.'); return false; }
    if (e.message === 'forbidden') { logout('Kein Zugriff. Dieses Konto ist kein Admin.'); return false; }
    boardError(e.message === 'offline' ? 'Keine Verbindung. Die Zahlen sind vom letzten Abruf.' : 'Abruf hat nicht geklappt. Es wird gleich erneut versucht.');
    return !$('kpis').children.length ? false : true;
  }
}

function render(d) {
  const k = d.overview?.kpis ?? {};
  const cost = d.overview?.ai_cost ?? {};
  const b = d.business ?? {};
  const rev = b.revenue ?? {}, subs = b.subs ?? {}, plans = b.plans ?? {};

  const light = trafficLight(d);
  $('light').dataset.level = light.level;
  $('light-text').textContent = light.reasons.join(' · ');
  $('stamp').textContent = `Stand ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

  const kpi = (label, value, caption) => el('div', { class: 'kpi' },
    el('span', { class: 'kpi-label', text: label }), el('strong', { text: value }), el('span', { class: 'kpi-caption', text: caption }));
  fill('kpis',
    kpi('Aktiv heute', int(k.active_today), `${int(k.active_7d)} in 7 Tagen`),
    kpi('Konten', int(k.users_total), `+${int(k.users_new_today)} heute · +${int(k.users_new_7d)} in 7 Tagen`),
    kpi('Pro aktiv', int(subs.active_total), `${int(plans.free)} Free · ${int(plans.beta)} Beta`),
    kpi('Umsatz Monat', euro(rev.gross_month_eur), `netto ca. ${euro(rev.net_month_eur)}`),
    kpi('KI-Kosten heute', usd(k.ai_usd_today), `${usd(k.ai_usd_month)} im Monat`),
    kpi('Nova Live jetzt', int(k.live_now), `${int(k.live_minutes_today)} Min. heute`));

  const series = d.overview?.series ?? [];
  fill('series',
    spark('Aktive Nutzer', series.map((s) => s.active_users), int),
    spark('Neue Konten', series.map((s) => s.signups), int),
    spark('KI-Kosten', series.map((s) => s.ai_usd), usd));

  const costMonthEur = (Number(k.ai_usd_month) || 0) * EUR_PER_USD;
  const result = (Number(rev.net_month_eur) || 0) - costMonthEur;
  fill('money',
    row('Umsatz Monat (brutto)', euro(rev.gross_month_eur)),
    row('davon nach Apple (netto)', euro(rev.net_month_eur)),
    row('KI-Kosten Monat', usd(k.ai_usd_month), `ca. ${euro(costMonthEur)}`),
    el('div', { class: `result ${result >= 0 ? 'plus' : 'minus'}` },
      el('span', { text: 'Ergebnis Monat' }), el('strong', { text: euro(result) })),
    row('Heute: Einzelkäufe / KI', `${euro(rev.gross_today_eur)} / ${usd(k.ai_usd_today)}`),
    row('Tagesgrenze KI genutzt', pct(cost.day_used_pct)));

  const f = b.funnel ?? {}, r = b.retention ?? {};
  const base = Number(f.accounts_30d) || 0;
  const step = (label, n) => {
    const share = base ? Math.round((Number(n) || 0) / base * 100) : 0;
    return el('div', { class: 'step' },
      el('div', { class: 'step-top' }, el('span', { text: label }), el('strong', { text: `${int(n)} · ${base ? share : 0} %` })),
      el('div', { class: 'bar' }, el('i', { style: `width:${Math.max(2, share)}%` })));
  };
  fill('retention',
    el('div', { class: 'pair' },
      el('div', {}, el('span', { class: 'kpi-label', text: 'Kommen am Tag 1 wieder' }), el('strong', { class: 'big', text: pct(r.d1_pct) }), el('span', { class: 'note', text: `von ${int(r.d1_cohort)}` })),
      el('div', {}, el('span', { class: 'kpi-label', text: 'Kommen am Tag 7 wieder' }), el('strong', { class: 'big', text: pct(r.d7_pct) }), el('span', { class: 'note', text: `von ${int(r.d7_cohort)}` }))),
    base ? [step('Konto angelegt (30 Tage)', f.accounts_30d), step('Onboarding fertig', f.onboarded_30d),
      step('Nova genutzt', f.used_nova_30d), step('An einem zweiten Tag zurück', f.returned_day2_30d)]
      : empty('Noch keine neuen Konten in den letzten 30 Tagen.'));

  const one = b.one_off ?? {};
  fill('business',
    row('Pro monatlich', int(subs.active_monthly)),
    row('Pro jährlich', int(subs.active_yearly)),
    row('24h-Pässe diesen Monat', int(one.pass_month), `${int(one.pass_total)} gesamt`),
    row('Präsentationen diesen Monat', int(one.presentation_month), `${int(one.presentation_total)} gesamt`),
    row('Wiederkehrend pro Monat', euro(rev.mrr_eur)));

  const e = d.errors ?? {};
  const areaName = { flutter: 'App-Oberfläche', async: 'Hintergrund', upload: 'Hochladen', exam: 'Probeklausur', live: 'Nova Live', smoke: 'Test' };
  const areas = (e.areas ?? []).slice(0, 6);
  const live = e.health?.live_close ?? {};
  fill('errors',
    el('div', { class: 'pair' },
      el('div', {}, el('span', { class: 'kpi-label', text: 'App-Fehler heute' }), el('strong', { class: 'big', text: int(e.today) })),
      el('div', {}, el('span', { class: 'kpi-label', text: 'Schnitt pro Tag' }), el('strong', { class: 'big', text: int(e.avg_7d) }))),
    bars((e.days ?? []).map((x) => x.total)),
    areas.length ? areas.map((a) => row(areaName[a.area] ?? a.area, int(a.total), a.code))
      : empty('Noch keine App-Fehler gemeldet. Sie erscheinen ab einem Build mit Fehlermeldung.'),
    row('Deep Fokus fehlgeschlagen', int(e.health?.deep_fokus_failed_7d)),
    row('Nova Live sauber beendet', live.healthy === false ? 'Prüfen' : 'Ja', live.overdue ? `${int(live.overdue)} offen` : null),
    el('a', { class: 'link', href: 'https://console.firebase.google.com/project/novaire-12f8d/crashlytics', target: '_blank', rel: 'noopener noreferrer', text: 'Abstürze in Crashlytics öffnen ↗' }));

  const fb = d.feedback ?? {}, counts = fb.counts ?? {};
  const items = fb.items ?? [];
  const rating = { gut: '🙂 gut', neutral: '😐 neutral', schlecht: '🙁 schlecht' };
  fill('feedback',
    el('div', { class: 'chips' },
      el('span', { class: 'chip', text: `${int(counts.neu)} neu` }),
      el('span', { class: 'chip', text: `${int(counts.gut)} gut` }),
      el('span', { class: 'chip', text: `${int(counts.neutral)} neutral` }),
      el('span', { class: 'chip', text: `${int(counts.schlecht)} schlecht` }),
      el('span', { class: 'chip', text: `${int(counts.total)} gesamt` })),
    items.length ? el('ul', { class: 'feedback' }, items.map((i) => el('li', {},
      el('div', { class: 'fb-head' },
        el('span', { class: `chip r-${i.rating ?? ''}`, text: rating[i.rating] ?? '–' }),
        el('span', { class: 'note', text: [i.area, i.created_at ? new Date(i.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : null, i.status].filter(Boolean).join(' · ') })),
      el('p', { text: i.message ?? '' }),
      el('span', { class: 'note', text: [i.app_version ? `Version ${i.app_version}` : null, i.device, i.screen].filter(Boolean).join(' · ') }))))
      : empty('Noch kein Feedback.'));
}

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function spark(label, values, format) {
  const nums = values.map((v) => Number(v) || 0);
  const box = el('div', { class: 'spark' },
    el('div', { class: 'spark-top' }, el('span', { text: label }), el('strong', { text: nums.length ? format(nums.at(-1)) : '–' })));
  if (nums.length < 2) return box.append(empty('Noch keine Daten.')), box;
  const max = Math.max(...nums, 1), w = 300, h = 64;
  const pts = nums.map((v, i) => `${(i / (nums.length - 1) * w).toFixed(1)},${(h - 4 - v / max * (h - 10)).toFixed(1)}`);
  const s = svg('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${label}, 30 Tage, zuletzt ${format(nums.at(-1))}` });
  s.append(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }));
  box.append(s);
  return box;
}

function bars(values) {
  const nums = values.map((v) => Number(v) || 0);
  const max = Math.max(...nums, 1);
  return el('div', { class: 'bars', 'aria-hidden': 'true' }, nums.map((v) => el('i', { style: `height:${Math.max(3, v / max * 100)}%` })));
}

$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const button = $('login-button');
  button.disabled = true; loginError('');
  try {
    session = await signIn(fetchImpl, $('email').value.trim(), $('password').value);
    $('password').value = '';
    // The board appears only once the server has answered as for an admin.
    if (!await load()) {
      if (session) { session = null; loginError('Abruf hat nicht geklappt. Bitte versuch es gleich noch einmal.'); }
      return;
    }
    show('board');
    clearInterval(timer);
    timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60_000);
  } catch (e) {
    loginError(e.message === 'offline' ? 'Keine Verbindung.' : 'E-Mail oder Passwort ist falsch.');
  } finally {
    button.disabled = false;
  }
});
$('logout').addEventListener('click', () => logout());
$('refresh').addEventListener('click', () => load());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && session) load(); });

if (demo) {
  const { demoFetch } = await import('./admin-demo.js');
  fetchImpl = demoFetch;
}
show('login');
