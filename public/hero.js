// Hero: a pinned, scroll-driven opening scene.
// Act 1 plays by itself on load (CSS animations in hero.css, started by data-hero-intro="play").
// Act 2 and 3 follow the page scroll: the headline recedes, the star becomes a quiet anchor,
// the sky travels, the countdown takes the stage, then the two links arrive and the stage releases.
// One passive scroll listener, work batched in requestAnimationFrame, nothing runs off screen.
// Per frame only transform, opacity and filter change. Never listens to wheel or touch input.
// Without JavaScript, under reduced motion or on very short screens the hero stays a static block.

// ---------- tuning (the lead tunes these in the browser) ----------

// Scroll progress windows, 0 = track top at the viewport top, 1 = the stage releases.
export const ACTS = {
  cue: [0, 0.03], // the scroll cue leaves as soon as scrolling starts
  recede: [0.12, 0.34], // headline and sub line move up, shrink and fade
  anchor: [0.12, 0.42], // the star rises and shrinks into its anchor at the top
  countdown: [0.3, 0.54], // the countdown fades in and settles
  travel: [0.12, 0.62], // the sky flows past
  travelIn: [0.12, 0.2], // the flight fades in …
  travelOut: [0.54, 0.62], // … and out, so the sky never rushes back
  links: [0.62, 0.76], // the two links arrive under the bar
};

export const TUNING = {
  recedeShift: 0.08, // share of the stage height the headline moves up (8vh)
  recedeScale: 0.92,
  recedeBlur: 6, // px at the end of the recession
  anchorScale: 0.6, // the star's size as an anchor
  countdownRise: 36, // px the countdown travels up while it fades in
  countdownBlur: 12, // px at the start of its fade
  linksRise: 18, // px
  travelDistance: 1, // window.novaireSky.travel at the end of act 2
};

export const VISIBLE_MIN = 0.05; // below this opacity a layer is inert: not tabbable, not read
export const INTRO_MS = 2600; // act 1 is over; later re-splits (language switch) no longer animate
export const SKIP_INTRO_AFTER = 0.02; // a reload further down the track skips act 1
const MIN_LIVE_HEIGHT = 520; // landscape phones keep the static hero

// ---------- pure maths ----------

const clamp01 = (value) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const span = (value, [from, to]) => clamp01((value - from) / (to - from));
const smooth = (value) => value * value * (3 - 2 * value);
const round = (value, digits = 3) => +value.toFixed(digits) + 0;

// Track position → progress. `top` is the track's top edge relative to the viewport.
export function heroProgress(top, trackHeight, viewHeight) {
  const travel = trackHeight - viewHeight;
  if (!(travel > 0)) return 0;
  return clamp01(-top / travel);
}

// Progress → the state of every layer. Linear in scroll, eased with smoothstep (no overshoot).
export function heroScene(progress, { acts = ACTS, tuning = TUNING } = {}) {
  const p = clamp01(progress);
  const recede = smooth(span(p, acts.recede));
  const anchor = smooth(span(p, acts.anchor));
  const arrive = smooth(span(p, acts.countdown));
  const links = smooth(span(p, acts.links));
  const flow = smooth(span(p, acts.travelIn)) * (1 - smooth(span(p, acts.travelOut)));
  return {
    cue: { opacity: round(1 - smooth(span(p, acts.cue))) },
    intro: {
      shift: round(-tuning.recedeShift * recede, 4), // share of the stage height, negative = up
      scale: round(1 - (1 - tuning.recedeScale) * recede, 4),
      opacity: round(1 - recede),
      blur: round(tuning.recedeBlur * recede, 2),
    },
    mark: { lift: round(anchor, 4), scale: round(1 - (1 - tuning.anchorScale) * anchor, 4) },
    countdown: {
      opacity: round(arrive),
      y: round(tuning.countdownRise * (1 - arrive), 2),
      blur: round(tuning.countdownBlur * (1 - arrive), 2),
    },
    links: { opacity: round(links), y: round(tuning.linksRise * (1 - links), 2) },
    sky: { travel: flow > 0 ? round(tuning.travelDistance * smooth(span(p, acts.travel)), 4) : 0, flow: round(flow, 4) },
  };
}

// Words of one headline line, as the visitor reads it in the current language.
export function splitWords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean);
}

// ---------- the scene ----------

const STYLE_KEYS = ['transform', 'opacity', 'filter', 'visibility'];

export function mountHero(section, { win = window } = {}) {
  const doc = win.document;
  const track = section.querySelector('.hero-track');
  const stage = section.querySelector('.hero-stage');
  const mark = section.querySelector('.hero-mark');
  const anchorProbe = section.querySelector('.hero-anchor');
  const intro = section.querySelector('.hero-intro');
  const title = section.querySelector('.hero-title');
  const lines = [...section.querySelectorAll('.hero-line')];
  const countdown = section.querySelector('.hero-countdown');
  const links = section.querySelector('.hero-explore-links');
  const cue = section.querySelector('.hero-cue');
  if (!track || !stage || !mark || !intro || !countdown) return null;

  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const tall = win.matchMedia(`(min-height: ${MIN_LIVE_HEIGHT}px)`);
  const sky = win.novaireSky = win.novaireSky || { travel: 0 };

  let live = null; // decided by the first sync
  let near = !win.IntersectionObserver;
  let frame = 0;
  let travel = 1;
  let stageHeight = 1;
  let markLift = 0;
  let tuning = TUNING;
  let ownsSky = false;
  let introTimer = 0;
  let introPlayed = false;
  const inert = new Map();

  // --- words: split after translation, re-split when the language changes ---
  function split() {
    if (!title) return;
    let index = 0;
    for (const line of lines) {
      const source = line.querySelector('.hero-line-text');
      if (!source) continue;
      const text = source.textContent;
      let words = line.querySelector('.hero-words');
      if (words && words.dataset.source === text) { index += words.children.length; continue; }
      if (!words) {
        words = doc.createElement('span');
        words.className = 'hero-words';
        words.setAttribute('aria-hidden', 'true');
        words.setAttribute('data-no-translate', '');
        line.append(words);
      }
      words.dataset.source = text;
      words.textContent = '';
      splitWords(text).forEach((word, position) => {
        if (position) words.append(' ');
        const span = doc.createElement('span');
        span.className = 'hero-word';
        span.textContent = word;
        span.style.setProperty('--i', String(index++));
        words.append(span);
      });
    }
    title.classList.add('is-split');
  }
  function unsplit() {
    if (!title) return;
    for (const words of section.querySelectorAll('.hero-words')) words.remove();
    title.classList.remove('is-split');
  }

  // --- layout ---
  function offsetWithin(element, ancestor) {
    let top = 0;
    for (let node = element; node && node !== ancestor; node = node.offsetParent) top += node.offsetTop;
    return top;
  }
  function measure() {
    stageHeight = Math.max(1, stage.offsetHeight);
    travel = Math.max(1, track.offsetHeight - stageHeight);
    // The star rises from where the layout puts it to the anchor line below the top bar.
    // offsetTop ignores transforms, so the measure is the same at any progress.
    markLift = anchorProbe ? offsetWithin(anchorProbe, stage) - offsetWithin(mark, stage) : 0;
    // hero.css owns the anchor size (it also places the countdown under it); read it from there.
    const anchorScale = parseFloat(win.getComputedStyle(section).getPropertyValue('--hero-anchor-scale'));
    tuning = Number.isFinite(anchorScale) && anchorScale > 0 ? { ...TUNING, anchorScale } : TUNING;
  }

  function setInert(element, on) {
    if (!element || inert.get(element) === on) return;
    inert.set(element, on);
    element.toggleAttribute('inert', on);
  }

  function releaseSky() {
    if (!ownsSky) return;
    ownsSky = false;
    sky.travel = 0;
    delete sky.flow;
  }

  function place(scene) {
    const { intro: a, mark: m, countdown: c, links: l, cue: q } = scene;
    intro.style.transform = `translate3d(0, ${round(a.shift * stageHeight, 1)}px, 0) scale(${a.scale})`;
    intro.style.opacity = String(a.opacity);
    intro.style.filter = a.blur > 0.05 ? `blur(${a.blur}px)` : 'none';
    mark.style.transform = `translate3d(0, ${round(m.lift * markLift, 1)}px, 0) scale(${m.scale})`;
    // No scale on the countdown: the particles measure the digits in screen pixels.
    countdown.style.transform = `translate3d(0, ${c.y}px, 0)`;
    countdown.style.opacity = String(c.opacity);
    countdown.style.filter = c.blur > 0.05 ? `blur(${c.blur}px)` : 'none';
    countdown.style.visibility = c.opacity < 0.002 ? 'hidden' : '';
    setInert(countdown, c.opacity < VISIBLE_MIN);
    if (links) {
      links.style.transform = `translate3d(0, ${l.y}px, 0)`;
      links.style.opacity = String(l.opacity);
      setInert(links, l.opacity < VISIBLE_MIN);
    }
    if (cue) {
      cue.style.opacity = String(q.opacity);
      cue.toggleAttribute('data-hero-cue-gone', q.opacity < 0.002);
    }
    if (scene.sky.flow > 0) {
      ownsSky = true;
      sky.travel = scene.sky.travel;
      sky.flow = scene.sky.flow;
    } else releaseSky();
  }

  const progress = () => heroProgress(track.getBoundingClientRect().top, travel + stageHeight, stageHeight);

  function update() {
    frame = 0;
    if (!live || !near || doc.hidden) return;
    place(heroScene(progress(), { tuning }));
  }
  const request = () => {
    if (live && near && !frame) frame = win.requestAnimationFrame(update);
  };

  function playIntro() {
    if (introPlayed) return;
    introPlayed = true;
    const skip = progress() > SKIP_INTRO_AFTER;
    section.setAttribute('data-hero-intro', skip ? 'done' : 'play');
    if (!skip) introTimer = win.setTimeout(() => section.setAttribute('data-hero-intro', 'done'), INTRO_MS);
  }

  function sync() {
    const allowed = !motion.matches && tall.matches;
    if (frame) { win.cancelAnimationFrame(frame); frame = 0; }
    if (allowed === live) { if (live) { measure(); request(); } return; }
    live = allowed;
    section.toggleAttribute('data-hero-live', live);
    section.toggleAttribute('data-hero-static', !live);
    if (live) {
      split();
      measure();
      playIntro();
      place(heroScene(progress(), { tuning }));
      return;
    }
    win.clearTimeout(introTimer);
    section.setAttribute('data-hero-intro', 'done');
    introPlayed = true;
    releaseSky();
    unsplit();
    for (const element of [intro, mark, countdown, links, cue]) {
      if (!element) continue;
      for (const key of STYLE_KEYS) element.style.removeProperty(key);
    }
    setInert(countdown, false);
    setInert(links, false);
    cue?.removeAttribute('data-hero-cue-gone');
  }

  win.addEventListener('scroll', request, { passive: true });
  // After a resize the rewards scene resets the sky synchronously; this frame writes it again.
  win.addEventListener('resize', () => { if (live) { measure(); request(); } }, { passive: true });
  motion.addEventListener('change', sync);
  tall.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) releaseSky(); else request(); });
  // i18n.js swaps whole text nodes; the visible words are rebuilt from the translated line.
  doc.addEventListener('novaire:languagechange', () => {
    if (!live) return;
    split();
    measure();
    request();
  });
  doc.fonts?.ready.then(() => { if (live) { measure(); request(); } });
  if (win.IntersectionObserver) {
    new win.IntersectionObserver(([entry]) => {
      near = entry.isIntersecting;
      if (near) { if (live) measure(); request(); } else releaseSky();
    }).observe(track);
  }
  sync();
  return { sync, progress, scene: () => heroScene(progress(), { tuning }) };
}

if (typeof document !== 'undefined') {
  const section = document.querySelector('[data-hero]');
  if (section) mountHero(section);
}
