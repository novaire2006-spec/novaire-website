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

// The beta started on 7 November; the green bar fills from here to the launch instant.
export const LAUNCH_START = Date.parse('2026-11-07T00:00:00+01:00');

export function launchProgress(now = Date.now(), start = LAUNCH_START, end = LAUNCH_AT) {
  if (!(end > start)) return 1;
  const value = (now - start) / (end - start);
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
