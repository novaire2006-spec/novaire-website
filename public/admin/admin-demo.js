// Fake numbers for looking at the layout on this computer (?demo=1 on
// 127.0.0.1 only). Never used on novaireai.de.
const days = Array.from({ length: 30 }, (_, i) => i);
const data = {
  token: { access_token: 'demo', expires_in: 3600 },
  admin_dashboard_overview: {
    kpis: { active_today: 312, active_7d: 1240, users_total: 3950, users_new_today: 84, users_new_7d: 610, live_now: 3, live_minutes_today: 146, ai_usd_today: 18.4, ai_usd_month: 402.7, feedback_new: 4, reports_open: 0 },
    ai_cost: { day_used_pct: 18, paused: false },
    series: days.map((i) => ({ active_users: 80 + i * 8 + (i % 5) * 12, signups: 20 + (i % 7) * 9 + i * 2, ai_usd: 4 + i * 0.5 + (i % 4) })),
  },
  admin_dashboard_business: {
    subs: { active_monthly: 71, active_yearly: 13, active_total: 84, new_7d: 22, new_30d: 84, ended_30d: 3 },
    one_off: { pass_month: 41, presentation_month: 17, pass_total: 41, presentation_total: 17 },
    revenue: { mrr_eur: 815.46, gross_month_eur: 1023.08, net_month_eur: 869.62, gross_today_eur: 58.9, apple_share: 0.15 },
    plans: { free: 2620, pro: 84, beta: 1246 },
    funnel: { accounts_30d: 2704, onboarded_30d: 2410, used_nova_30d: 1980, returned_day2_30d: 1190 },
    retention: { d1_pct: 46, d7_pct: 21, d1_cohort: 2620, d7_cohort: 1870 },
  },
  admin_dashboard_errors: {
    today: 6, avg_7d: 4.3,
    days: [3, 5, 4, 7, 2, 4, 6].map((total) => ({ total })),
    areas: [{ area: 'live', code: 'timeout', total: 12 }, { area: 'upload', code: 'formatError', total: 7 }, { area: 'flutter', code: 'flutterError', total: 5 }],
    health: { deep_fokus_failed_7d: 1, live_close: { healthy: true, overdue: 0 } },
  },
  admin_dashboard_feedback: {
    counts: { total: 128, neu: 4, gut: 91, neutral: 25, schlecht: 12 },
    items: [
      { rating: 'gut', area: 'Chat', created_at: new Date().toISOString(), status: 'neu', message: 'Nova erklärt Mathe richtig gut, viel besser als in der Schule.', app_version: '1.0.0 (15)', device: 'iPhone 15', screen: 'Home' },
      { rating: 'schlecht', area: 'Nova Live', created_at: new Date(Date.now() - 3600e3).toISOString(), status: 'neu', message: 'Live hat sich einmal aufgehängt, als ich das Handy gedreht habe.', app_version: '1.0.0 (15)', device: 'iPhone 12', screen: 'Live' },
      { rating: 'neutral', area: 'Karteikarten', created_at: new Date(Date.now() - 86400e3).toISOString(), status: 'gelesen', message: 'Wäre cool, wenn man Karten teilen könnte.', app_version: '1.0.0 (14)', device: 'iPad Air', screen: 'Karteikarten' },
    ],
  },
};
export async function demoFetch(url) {
  const key = String(url).includes('/auth/v1/token') ? 'token' : String(url).split('/rpc/')[1];
  return new Response(JSON.stringify(data[key] ?? {}), { status: 200 });
}
