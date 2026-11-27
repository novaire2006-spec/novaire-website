import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Admin dashboard (owner 27.11.2026): novaireai.de/admin, admins only.
const core = await import('../public/admin/admin-core.js');
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  return { impl, calls };
}

test('sign-in sends e-mail and password only in the body, never in the address', async () => {
  const { impl, calls } = fakeFetch(200, { access_token: 'tok', expires_in: 3600 });
  const session = await core.signIn(impl, 'admin@example.invalid', 'geheim-123');
  assert.equal(session.token, 'tok');
  assert.ok(session.expiresAt > Date.now());
  assert.match(calls[0].url, /\/auth\/v1\/token\?grant_type=password$/);
  assert.doesNotMatch(calls[0].url, /geheim|admin@/);
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'admin@example.invalid', password: 'geheim-123' });
  assert.equal(calls[0].init.method, 'POST');
});

test('a wrong password is a login error, not a crash', async () => {
  const { impl } = fakeFetch(400, { error: 'invalid_grant' });
  await assert.rejects(core.signIn(impl, 'a@b.invalid', 'x'), /login/);
});

test('rpc: 401 means the session ran out, admin_only means no access', async () => {
  await assert.rejects(core.callRpc(fakeFetch(401, {}).impl, 'tok', 'admin_dashboard_overview'), /expired/);
  await assert.rejects(core.callRpc(fakeFetch(403, { message: 'admin_only' }).impl, 'tok', 'admin_dashboard_overview'), /forbidden/);
  await assert.rejects(core.callRpc(fakeFetch(400, { message: 'admin_only' }).impl, 'tok', 'admin_dashboard_overview'), /forbidden/);
  const ok = fakeFetch(200, { kpis: { active_today: 3 } });
  const data = await core.callRpc(ok.impl, 'tok', 'admin_dashboard_errors', { p_days: 7 });
  assert.equal(data.kpis.active_today, 3);
  assert.match(ok.calls[0].url, /\/rest\/v1\/rpc\/admin_dashboard_errors$/);
  assert.equal(ok.calls[0].init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(ok.calls[0].init.body), { p_days: 7 });
});

const calm = {
  overview: { kpis: { feedback_new: 0, reports_open: 0 }, ai_cost: { day_used_pct: 10, paused: false } },
  business: {},
  errors: { today: 1, avg_7d: 2 },
};

test('traffic light: green when nothing waits', () => {
  assert.equal(core.trafficLight(calm).level, 'green');
});

test('traffic light: yellow for new feedback or open reports', () => {
  const s = structuredClone(calm); s.overview.kpis.feedback_new = 2;
  const r = core.trafficLight(s);
  assert.equal(r.level, 'yellow');
  assert.ok(r.reasons.some((x) => x.includes('Feedback')));
});

test('traffic light: red for costs over 80 %, a pause or an error spike', () => {
  const cost = structuredClone(calm); cost.overview.ai_cost.day_used_pct = 85;
  assert.equal(core.trafficLight(cost).level, 'red');
  const paused = structuredClone(calm); paused.overview.ai_cost.paused = true;
  assert.equal(core.trafficLight(paused).level, 'red');
  const spike = structuredClone(calm); spike.errors = { today: 30, avg_7d: 4 };
  assert.equal(core.trafficLight(spike).level, 'red');
  // A few errors on a quiet week are no spike.
  const few = structuredClone(calm); few.errors = { today: 3, avg_7d: 0 };
  assert.equal(core.trafficLight(few).level, 'green');
});

test('traffic light never breaks on missing data', () => {
  assert.ok(['green', 'yellow', 'red'].includes(core.trafficLight({}).level));
});

test('numbers read German', () => {
  assert.equal(core.euro(1234.5), '1.234,50 €');
  assert.equal(core.euro(null), '–');
  assert.equal(core.pct(46), '46 %');
  assert.equal(core.pct(null), '–');
  assert.equal(core.int(3950), '3.950');
});

test('the page holds no token storage, no service key, no innerHTML', async () => {
  for (const file of ['public/admin/admin-core.js', 'public/admin/admin.js']) {
    const src = await read(file);
    assert.doesNotMatch(src, /localStorage|sessionStorage|document\.cookie|service_role|innerHTML|insertAdjacentHTML|eval\(/, file);
  }
});

test('the page is hidden from search engines and never cached', async () => {
  const html = await read('public/admin/index.html');
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /<html lang="de">/);
  // Not in robots.txt: that file is public and would name the address.
  const robots = await read('public/robots.txt');
  assert.doesNotMatch(robots, /admin/);
  const vercel = JSON.parse(await read('vercel.json'));
  const rule = vercel.headers.find((h) => h.source === '/admin/:path*');
  assert.ok(rule, 'own header rule for /admin');
  const header = (k) => rule.headers.find((h) => h.key === k)?.value ?? '';
  assert.equal(header('Cache-Control'), 'no-store');
  const csp = header('Content-Security-Policy');
  assert.match(csp, /connect-src https:\/\/naafzrrhjsfaqqrnhrcn\.supabase\.co\/auth\/v1\/token https:\/\/naafzrrhjsfaqqrnhrcn\.supabase\.co\/rest\/v1\/rpc\//);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
  // The admin rule comes after the site-wide one, so its CSP wins.
  assert.ok(vercel.headers.indexOf(rule) > vercel.headers.findIndex((h) => h.source === '/(.*)'));
});

test('the demo data only loads on this computer', async () => {
  const src = await read('public/admin/admin.js');
  assert.match(src, /location\.hostname === '127\.0\.0\.1'/);
});
