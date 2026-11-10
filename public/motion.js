/* Scroll-linked motion: header, ring, threads, story line. No network, storage or tracking. */
(() => {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const all = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (value) => Math.min(1, Math.max(0, value));

  const hero = document.querySelector('.marketing-page .hero');
  const orbit = document.querySelector('.orbit');
  const orbitArc = orbit ? orbit.querySelector('.orbit-progress') : null;
  const orbitStars = orbit ? [...orbit.querySelectorAll('.orbit-star')] : [];
  const threads = all('.marketing-page .section-heading, .marketing-page .closing');
  const timeline = document.querySelector('.story-timeline');
  const steps = timeline ? [...timeline.children] : [];
  const figure = document.querySelector('.growth-figure');
  const curve = figure ? figure.querySelector('.growth-curve') : null;
  const drifters = all('.marketing-page .product-visual');
  let threadLengths = [];
  let queued = false;

  // The thread above a heading is a pseudo-element; its length sets how far the page scrolls while it draws.
  const measure = () => {
    threadLengths = threads.map((element) => parseFloat(getComputedStyle(element, '::before').height) || 96);
  };

  const update = () => {
    queued = false;
    const still = motion.matches;
    const scroll = window.scrollY;
    const height = window.innerHeight;
    const mark = height * 0.62;

    // Read every position first, then write, so the browser lays the page out only once.
    const heroHeight = hero ? hero.offsetHeight : 0;
    const orbitBox = orbit ? orbit.getBoundingClientRect() : null;
    const threadTops = threads.map((element) => element.getBoundingClientRect().top);
    const timelineBox = timeline ? timeline.getBoundingClientRect() : null;
    const stepTops = steps.map((step) => step.getBoundingClientRect().top);
    const figureBox = figure ? figure.getBoundingClientRect() : null;
    const driftBoxes = drifters.map((element) => element.getBoundingClientRect());

    root.classList.toggle('at-top', scroll < 12);
    if (hero) hero.style.setProperty('--exit', still ? '0' : clamp(scroll / Math.max(1, heroHeight * 0.85)).toFixed(3));

    if (orbit) {
      // The ring fills while it travels from the lower part of the screen to the middle.
      const progress = still ? 1 : clamp((height * 0.82 - orbitBox.top) / (orbitBox.height * 1.4));
      orbit.style.setProperty('--p', progress.toFixed(4));
      if (orbitArc) orbitArc.style.strokeDasharray = `${progress.toFixed(4)} 1`;
      orbitStars.forEach((star, index) => star.classList.toggle('is-lit', progress > index / 4 + 0.015));
      orbit.classList.toggle('is-complete', progress >= 0.995);
    }

    threads.forEach((element, index) => {
      const progress = still ? 1 : clamp((height * 0.9 - threadTops[index]) / (threadLengths[index] * 1.7));
      element.style.setProperty('--thread', progress.toFixed(4));
    });

    if (timeline) {
      const progress = clamp((mark - timelineBox.top) / Math.max(1, timelineBox.height));
      timeline.style.setProperty('--progress', progress.toFixed(4));
      steps.forEach((step, index) => step.classList.toggle('is-reached', stepTops[index] + 8 < mark));
    }

    if (curve) {
      const progress = still ? 1 : clamp((height * 0.86 - figureBox.top) / (figureBox.height * 0.8));
      curve.style.strokeDashoffset = (1 - progress).toFixed(4);
      figure.classList.toggle('is-drawn', progress >= 0.985);
    }

    drifters.forEach((element, index) => {
      const box = driftBoxes[index];
      const through = still ? 0 : clamp((height - box.top) / (height + box.height));
      element.style.setProperty('--drift', through.toFixed(4));
    });
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  root.classList.add('motion-ready');
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', () => { measure(); request(); });
  motion.addEventListener('change', request);
  measure();
  update();
})();
