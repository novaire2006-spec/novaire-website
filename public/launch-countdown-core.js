// One absolute instant, regardless of the visitor's timezone or daylight saving.
export const LAUNCH_AT = Date.parse('2026-11-27T18:00:00+01:00');

export function launchTimeRemaining(now = Date.now()) {
  const total = Math.max(0, Math.ceil((LAUNCH_AT - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
    ended: total === 0,
  };
}
