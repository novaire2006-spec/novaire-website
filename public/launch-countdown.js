import { launchTimeRemaining } from './launch-countdown-core.js';

const banner = document.querySelector('[data-launch-countdown]');
if (banner) {
  const clock = banner.querySelector('[role="timer"]');
  const values = [...banner.querySelectorAll('[data-launch-unit]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let timeout;
  let inView = true;
  let initialized = false;
  let ended = false;

  function render() {
    const remaining = launchTimeRemaining();
    for (const element of values) {
      const next = String(remaining[element.dataset.launchUnit]).padStart(2, '0');
      if (element.textContent === next) continue;
      element.textContent = next;
      if (initialized && !motion.matches && !document.hidden && inView && element.animate) {
        element.getAnimations().forEach(animation => animation.cancel());
        element.animate(
          [{ transform: 'translateY(-18%)', opacity: .25 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' },
        );
      }
    }
    initialized = true;
    ended = remaining.ended;
    clock.hidden = ended;
    if (ended) {
      banner.querySelector('[data-launch-status]').textContent = '27. NOVEMBER 2026';
      banner.querySelector('[data-launch-arrived]').hidden = false;
      // Reaching the date does not verify App Store approval. No invented download link.
      banner.dataset.state = 'arrived';
    }
  }

  function tick() {
    clearTimeout(timeout);
    if (document.hidden || !inView) return;
    render();
    // Recompute from the wall clock, not a decreasing counter, to avoid drift.
    if (!ended) timeout = setTimeout(tick, 1000 - Date.now() % 1000 + 20);
  }

  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  window.addEventListener('pagehide', () => clearTimeout(timeout));
  motion.addEventListener('change', () => {
    if (motion.matches) values.forEach(element => element.getAnimations?.().forEach(animation => animation.cancel()));
  });
  tick();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      tick();
    }).observe(banner);
  }
}
