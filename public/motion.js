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
  const learning = document.querySelector('.learning-map');
  const learningSteps = learning ? [...learning.querySelectorAll('.learning-map-step')] : [];
  let threadLengths = [];
  let queued = false;

  // One line runs from the second section to the end of the page. It is drawn down to the
  // reading line, takes the colour of each section it passes and carries a small light at its tip.
  const main = document.querySelector('.marketing-page:not(.beta-page) main');
  const railSections = main ? [...main.querySelectorAll(':scope > section')].slice(1) : [];
  const rail = railSections.length > 3 ? document.createElement('div') : null;
  const railFill = rail ? document.createElement('span') : null;
  let railStart = 0;
  let railLength = 0;
  let railStops = [];
  if (rail) {
    rail.className = 'journey-rail';
    rail.setAttribute('aria-hidden', 'true');
    const track = document.createElement('span');
    const tip = document.createElement('span');
    track.className = 'journey-track';
    railFill.className = 'journey-fill';
    tip.className = 'journey-tip';
    rail.append(track, railFill, tip);
    main.append(rail);
  }
  const layoutRail = () => {
    if (!rail) return;
    const origin = main.getBoundingClientRect().top;
    const first = railSections[0].getBoundingClientRect().top - origin + 48;
    const last = railSections[railSections.length - 1].getBoundingClientRect().bottom - origin - 72;
    railStart = first + origin + window.scrollY;
    railLength = Math.max(0, last - first);
    rail.style.top = `${Math.round(first)}px`;
    rail.style.height = `${Math.round(railLength)}px`;
    railStops = railSections.map((section, index) => ({
      start: index ? section.getBoundingClientRect().top - origin - first : 0,
      color: getComputedStyle(section).getPropertyValue('--dot').trim() || '#fff',
    }));
    const blend = 110;
    const parts = [];
    railStops.forEach((stop, index) => {
      const next = railStops[index + 1];
      parts.push(`${stop.color} ${Math.round(stop.start + (index ? blend : 0))}px`);
      parts.push(`${stop.color} ${Math.round(next ? next.start - blend : railLength)}px`);
    });
    railFill.style.background = `linear-gradient(${parts.join(', ')})`;
  };

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
    const learningBox = learning ? learning.getBoundingClientRect() : null;

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

    if (learning) {
      const progress = still ? 1 : clamp((height * 0.8 - learningBox.top) / (learningBox.height * 0.8));
      learningSteps.forEach((step, index) => step.classList.toggle('is-reached', progress >= 0.2 + index * 0.2));
    }

    if (rail) {
      const reach = still ? railLength : Math.min(railLength, Math.max(0, scroll + mark - railStart));
      let color = '#fff';
      for (const stop of railStops) if (stop.start <= reach + 1) color = stop.color;
      rail.style.setProperty('--y', `${reach.toFixed(1)}px`);
      rail.style.setProperty('--tip', color);
      rail.classList.toggle('is-active', reach > 2);
      rail.classList.toggle('is-still', still);
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
  window.addEventListener('resize', () => { measure(); layoutRail(); request(); });
  motion.addEventListener('change', request);
  // Images and fonts can still change the page height after the first layout.
  if (rail && 'ResizeObserver' in window) new ResizeObserver(() => { layoutRail(); request(); }).observe(main);
  measure();
  layoutRail();
  update();
})();
