import { createGalaxy, galaxyGestures } from './galaxies.js';
import { createBlackHole } from './blackhole.js';

const section = document.querySelector('.rewards-section');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (section) start();

function start() {
  const track = section.querySelector('.rewards-track');
  const stage = section.querySelector('.rewards-stage');
  const skyElement = stage.querySelector('.rewards-sky');
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const span = (value, from, to) => clamp((value - from) / (to - from));
  const smooth = (value) => value * value * (3 - 2 * value);
  const sky = window.novaireSky = window.novaireSky || { travel: 0 };

  function body(name, kind) {
    const canvas = section.querySelector('[data-body="' + name + '"]');
    return { canvas, model: kind ? createGalaxy(canvas, kind) : null, alpha: 0, scale: 0, x: 0 };
  }
  const galaxy = body('galaxy', 'spiral');
  const friend = body('friend', 'sombrero');
  const hole = body('blackhole');
  const bodies = [galaxy, hole, friend];
  const captions = [...section.querySelectorAll('.rewards-caption')];
  const labels = [...section.querySelectorAll('.rewards-label')];
  const kinds = [...section.querySelectorAll('.rarity-scale li')];

  let size = 0, width = 0, frame = 0, last = 0, progress = -1;
  let near = false, compileTried = false, drawHole, holeResolution = 1.3;
  const measure = () => { size = galaxy.canvas.clientWidth; width = stage.clientWidth; };

  // An object approaches from far away, rests, then flies past the viewer.
  const approach = (p, start, arrive, leave, gone) => {
    if (p <= start || p >= gone) return { scale: 0, alpha: 0 };
    if (p < arrive) {
      const closer = smooth((p - start) / (arrive - start));
      return { scale: .73 + .27 * closer, alpha: Math.min(1, closer / 0.1) };
    }
    if (p < leave) return { scale: 1 + 0.05 * (p - arrive) / (leave - arrive), alpha: 1 };
    const out = (p - leave) / (gone - leave);
    return { scale: 1.05 + .16 * smooth(out), alpha: 1 - smooth(out) };
  };

  const place = (p) => {
    const pair = Math.min(0.6, (width * 0.4) / Math.max(1, size));
    const aside = Math.min(width * 0.24, size * 0.4);
    const meet = smooth(span(p, 0.76, 0.92));
    if (p < 0.6) {
      Object.assign(galaxy, approach(p, -.26, .08, .38, .5), { x: 0 });
      Object.assign(friend, { scale: 0, alpha: 0, x: 0 });
    } else {
      const state = meet > 0 ? { scale: (.72 + .28 * meet) * pair, alpha: Math.min(1, meet / 0.1) } : { scale: 0, alpha: 0 };
      Object.assign(galaxy, state, { x: -aside * meet });
      Object.assign(friend, state, { x: aside * meet });
    }
    Object.assign(hole, approach(p, 0.42, 0.6, 0.71, 0.79), { x: 0 });

    for (const item of bodies) {
      item.canvas.style.opacity = item.alpha.toFixed(3);
      item.canvas.style.transform = `translate3d(${item.x.toFixed(1)}px, 0, 0) scale(${Math.max(0.001, item.scale).toFixed(4)})`;
    }
    const windows = [[-.16, 0, .38, .47], [.46, .55, .72, .79], [.78, .89, 2, 3]];
    captions.forEach((caption, index) => {
      const [fromIn, toIn, fromOut, toOut] = windows[index];
      const enter = smooth(span(p, fromIn, toIn));
      const exit = smooth(span(p, fromOut, toOut));
      caption.style.opacity = (enter * (1 - exit)).toFixed(3);
      caption.style.transform = `translate3d(-50%, ${((1 - enter) * 28 - exit * 18).toFixed(1)}px, 0)`;
      caption.classList.toggle('is-shown', enter > 0.5 && exit < 0.5);
    });
    const lit = Math.floor(span(p, 0.56, 0.68) * kinds.length + 0.001);
    kinds.forEach((kind, index) => kind.classList.toggle('is-lit', index < lit));
    const named = smooth(span(p, 0.88, 0.94));
    labels.forEach((label, index) => {
      const side = index ? aside : -aside;
      label.style.opacity = named.toFixed(3);
      label.style.transform = `translate3d(calc(-50% + ${side.toFixed(1)}px), ${(size * pair * 0.44 + 14).toFixed(1)}px, 0)`;
    });
    // The star field flows towards the viewer for as long as the scene runs.
    sky.travel = p * 1.5 * (1 - smooth(span(p, .94, 1)));
  };

  function update(now) {
    frame = 0;
    if (!near || document.hidden || motion.matches) { sky.lens = null; return; }
    frame = requestAnimationFrame(update);
    const view = innerHeight;
    const box = track.getBoundingClientRect();
    const p = clamp((view * .3 - box.top) / Math.max(1, box.height - view * .7));
    if (progress !== p) { progress = p; place(p); }
    if (hole.alpha > .01) {
      const rect = hole.canvas.getBoundingClientRect();
      sky.lens = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
        radius: rect.width * .175, strength: hole.alpha };
    } else sky.lens = null;
    if (now - last < 1000 / 32) return;
    for (const item of [galaxy,friend]) {
      if (item.alpha < .01) continue;
      const pixels = Math.max(48, Math.min(1600, Math.ceil(size * item.scale * Math.min(devicePixelRatio, 3) / 8) * 8));
      item.model?.draw(now,pixels);
    }
    if (hole.alpha > .01) {
      if (!compileTried) { compileTried = true; drawHole = createBlackHole(hole.canvas); }
      if (last && now - last > 85) holeResolution = Math.max(.64, holeResolution - .025);
      const pixels = Math.min(800, Math.max(96, Math.round(size * Math.min(hole.scale,1) * holeResolution / 32) * 32));
      drawHole?.(now / 1000, pixels);
    }
    last = now;
  }
  function sync() {
    cancelAnimationFrame(frame);
    sky.lens = null; sky.travel = 0;
    section.classList.toggle('rewards-live', !motion.matches);
    if (motion.matches) for (const caption of captions) {
      caption.style.removeProperty('opacity');
      caption.style.removeProperty('transform');
    }
    // Use the same sharp drawing for the static layout when motion is reduced.
    for (const [item, caption] of [[galaxy, captions[0]], [friend, captions[2]]]) {
      const parent = motion.matches ? caption : skyElement;
      if (item.model && item.canvas.parentElement !== parent) {
        parent.prepend(item.canvas);
        item.canvas.style.removeProperty('opacity');
        item.canvas.style.removeProperty('transform');
        item.canvas.setAttribute('aria-hidden', 'true');
      }
      if (motion.matches && near && item.model) {
        item.model.draw(performance.now(), Math.ceil(item.canvas.clientWidth * Math.min(devicePixelRatio, 3)), true);
      }
    }
    measure(); progress = -1; last = 0;
    if (near && !document.hidden && !motion.matches) frame = requestAnimationFrame(update);
  }
  galaxyGestures(stage, () => motion.matches ? [] : [galaxy,friend].filter(item => item.model && item.alpha > .15));
  window.addEventListener('resize', sync);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { near = entry.isIntersecting; sync(); }, {rootMargin:'80px 0px'}).observe(track);
  } else near = true;
  sync();
}
