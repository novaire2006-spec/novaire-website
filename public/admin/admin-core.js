// Admin dashboard (owner 27.11.2026): pure helpers, no DOM.
// The key below is Supabase's public "anon" key (also inside the app). It
// grants nothing by itself: every number comes from admin_dashboard_*
// functions that check the admin role on the server.
export const SUPABASE_URL = 'https://naafzrrhjsfaqqrnhrcn.supabase.co';
export const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYWZ6cnJoanNmYXFxcm5ocmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDU2NjksImV4cCI6MjA5NTg4MTY2OX0.Bf-5GHKo8LnrqfRc4HKYR48RBr4Nhmaza3mfWlxuu1o';

/** Signs in with e-mail and password. The token lives only in memory. */
export async function signIn(fetchImpl, email, password) {
  let res;
  try {
    res = await fetchImpl(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch { throw new Error('offline'); }
  if (!res.ok) throw new Error('login');
  const data = await res.json();
  if (!data.access_token) throw new Error('login');
  return { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
}

/** Calls one admin function. Throws 'expired', 'forbidden' or 'failed'. */
export async function callRpc(fetchImpl, token, name, params = {}) {
  let res;
  try {
    res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch { throw new Error('offline'); }
  if (res.status === 401) throw new Error('expired');
  const text = await res.text();
  if (!res.ok) throw new Error(text.includes('admin_only') ? 'forbidden' : 'failed');
  try { return JSON.parse(text); } catch { throw new Error('failed'); }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

/** Green, yellow or red, with the reasons in plain German. */
export function trafficLight({ overview = {}, business = {}, errors = {} } = {}) {
  const kpis = overview.kpis ?? {};
  const cost = overview.ai_cost ?? {};
  const red = [], yellow = [];
  const used = num(cost.day_used_pct);
  if (cost.paused) red.push('KI ist wegen der Kostengrenze pausiert');
  if (used !== null && used > 80) red.push(`KI-Kosten heute bei ${Math.round(used)} % der Tagesgrenze`);
  const today = num(errors.today) ?? 0, avg = num(errors.avg_7d) ?? 0;
  if (today >= 5 && today > 3 * avg) red.push(`Viele Fehler heute (${today})`);
  const stale = num(business?.reports_stale) ?? 0;
  if (stale > 0) red.push(`${stale} Meldungen seit über 24 Stunden offen`);
  if ((num(kpis.reports_open) ?? 0) > 0) yellow.push(`${kpis.reports_open} offene Meldungen`);
  if ((num(kpis.feedback_new) ?? 0) > 0) yellow.push(`${kpis.feedback_new} neues Feedback`);
  if (red.length) return { level: 'red', reasons: [...red, ...yellow] };
  if (yellow.length) return { level: 'yellow', reasons: yellow };
  return { level: 'green', reasons: ['Alles läuft'] };
}

const de = (opts) => new Intl.NumberFormat('de-DE', opts);
export const euro = (v) => (num(v) === null ? '–' : `${de({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))} €`);
export const usd = (v) => (num(v) === null ? '–' : `${de({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))} $`);
export const pct = (v) => (num(v) === null ? '–' : `${de({ maximumFractionDigits: 0 }).format(num(v))} %`);
export const int = (v) => (num(v) === null ? '–' : de({ maximumFractionDigits: 0 }).format(num(v)));

/** Rough rate to compare euro revenue with dollar AI costs; shown as an estimate. */
export const EUR_PER_USD = 0.9;
