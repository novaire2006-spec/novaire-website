/* Scroll-linked motion: header and story chapters. No network, storage or tracking. */
import { setupStory } from './storyline.js';

(() => {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value) => Math.min(1, Math.max(0, value));

  const hero = document.querySelector('.marketing-page .hero');
  const story = setupStory();
  const learning = document.querySelector('.learning-map');
  const learningSteps = learning ? [...learning.querySelectorAll('.learning-map-step')] : [];
  let queued = false;

  const main = document.querySelector('.marketing-page:not(.beta-page) main');

  const update = () => {
    queued = false;
    const still = motion.matches;
    const scroll = window.scrollY;
    const height = window.innerHeight;

    // Read every position first, then write, so the browser lays the page out only once.
    const heroHeight = hero ? hero.offsetHeight : 0;
    const learningBox = learning ? learning.getBoundingClientRect() : null;

    root.classList.toggle('at-top', scroll < 12);
    if (hero) hero.style.setProperty('--exit', still ? '0' : clamp(scroll / Math.max(1, heroHeight * 0.85)).toFixed(3));

    story?.update();

    if (learning) {
      const progress = still ? 1 : clamp((height * 0.8 - learningBox.top) / (learningBox.height * 0.8));
      learningSteps.forEach((step, index) => step.classList.toggle('is-reached', progress >= 0.2 + index * 0.2));
    }
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  root.classList.add('motion-ready');
  window.addEventListener('scroll', request, { passive: true });
  const refresh = () => { story?.measure(); request(); };
  window.addEventListener('resize', refresh);
  motion.addEventListener('change', refresh);
  document.addEventListener('novaire:languagechange', refresh);
  if (main && 'ResizeObserver' in window) new ResizeObserver(refresh).observe(main);
  document.fonts?.ready.then(refresh);
  story?.measure();
  update();
})();
