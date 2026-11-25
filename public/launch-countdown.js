import { launchTimeRemaining, launchProgress } from './launch-countdown-core.js';
import { createDigitBurst, MAX_PARTICLES } from './countdown-particles.js';

const banner = document.querySelector('[data-launch-countdown]');
if (banner) {
  const clock = banner.querySelector('[role="timer"]');
  // Seconds first: when several units change in one tick, they get the particle budget first.
  const values = [...banner.querySelectorAll('[data-launch-unit]')].reverse();
  const progressBlock = banner.querySelector('[data-launch-progress]');
  const progressBar = banner.querySelector('[role="progressbar"]');
  const progressFill = banner.querySelector('.launch-progress-fill');
  const canvas = banner.querySelector('.launch-countdown-burst');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 699px)');
  const particles = canvas
    ? createDigitBurst(canvas, {
      reducedMotion: () => motion.matches,
      maxParticles: () => (phone.matches ? MAX_PARTICLES / 2 : MAX_PARTICLES),
    })
    : null;
  let timeout;
  let inView = true;
  let initialized = false;
  let ended = false;

  // The old digits dissolve exactly where they stood: the burst samples the glyphs at the
  // value's own box, in its own font and colour, relative to the canvas over the clock.
  function dissolve(element, text, canvasBox) {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    particles.burst(
      text,
      { x: box.left - canvasBox.left, y: box.top - canvasBox.top, width: box.width, height: box.height },
      `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
      style.color,
      { letterSpacing: parseFloat(style.letterSpacing) || 0 },
    );
  }

  function showProgress(value) {
    if (!progressBlock || !progressBar) return;
    progressBar.style.setProperty('--launch-progress', value.toFixed(6));
    if (progressBlock.hidden) {
      progressBlock.hidden = false;
      // The fill runs in from the left once. Per-second updates are sub-pixel and need no transition.
      if (!motion.matches && progressFill?.animate) {
        progressFill.animate([{ width: '0%' }, { width: `${(value * 100).toFixed(4)}%` }], { duration: 1400, easing: 'cubic-bezier(.22,.61,.36,1)' });
      }
    }
    const percent = String(Math.floor(value * 100));
    if (progressBar.getAttribute('aria-valuenow') !== percent) progressBar.setAttribute('aria-valuenow', percent);
  }

  // The hero scene marks the countdown inert while it is still invisible (hero.js): no particles then.
  // Every burst measures the digit and canvas boxes afresh, so a moved, resized or translated stage
  // still dissolves the digits exactly where they stand.
  const veiled = () => Boolean(banner.closest?.('[inert]'));

  function render() {
    const now = Date.now();
    const remaining = launchTimeRemaining(now);
    const animate = initialized && !remaining.ended && !motion.matches && !document.hidden && inView && !veiled();
    const canvasBox = animate && particles ? canvas.getBoundingClientRect() : null;
    for (const element of values) {
      const previous = element.textContent;
      const next = String(remaining[element.dataset.launchUnit]).padStart(2, '0');
      if (previous === next) continue;
      if (canvasBox) dissolve(element, previous, canvasBox);
      // The DOM text is always the real value; the effect only decorates the change.
      element.textContent = next;
      if (animate && element.animate) {
        element.getAnimations().forEach(animation => animation.cancel());
        element.animate(
          [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)' }],
          { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' },
        );
      }
    }
    initialized = true;
    ended = remaining.ended;
    showProgress(ended ? 1 : launchProgress(now));
    clock.hidden = ended;
    if (ended) {
      particles?.stop();
      banner.querySelector('[data-launch-status]').textContent = '27. November 2026';
      banner.querySelector('[data-launch-arrived]').hidden = false;
      // Reaching the date does not verify App Store approval. No invented download link.
      banner.dataset.state = 'arrived';
    }
  }

  function tick() {
    clearTimeout(timeout);
    if (document.hidden || !inView) {
      particles?.stop();
      return;
    }
    render();
    // Recompute from the wall clock, not a decreasing counter, to avoid drift.
    if (!ended) timeout = setTimeout(tick, 1000 - Date.now() % 1000 + 20);
  }

  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  window.addEventListener('pagehide', () => {
    clearTimeout(timeout);
    particles?.stop();
  });
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    particles?.stop();
    values.forEach(element => element.getAnimations?.().forEach(animation => animation.cancel()));
  });
  tick();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      tick();
    }).observe(banner);
  }
}
