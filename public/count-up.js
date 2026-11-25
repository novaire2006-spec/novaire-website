// A fast count from 0 to a target. Pure functions, no DOM: storyline.js drives the frames.

// Ease-out cubic: most of the number arrives early, the last digits settle. Never overshoots.
export function countUpValue(elapsedMs, target, durationMs = 900) {
  if (!(elapsedMs > 0)) return 0;
  if (elapsedMs >= durationMs) return target;
  const t = elapsedMs / durationMs;
  return Math.round(target * (1 - Math.pow(1 - t, 3)));
}

// Thousands grouping without Intl, so every browser shows the same: 3.712 in German, 3,712 in English.
export function formatCount(n, language = 'de') {
  const separator = language === 'en' ? ',' : '.';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
