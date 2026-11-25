// Feature wheel: the option wheel from 21st.dev, rebuilt without React.
// The page scroll turns it. It never listens to wheel or touch input and never
// calls preventDefault on them, so the visitor's scroll is never captured.
// Per frame only transform, opacity, filter and colour change.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 2) => +value.toFixed(digits) + 0;

// The component's maths for side "left": rows sit on a circle whose hub lies to
// the left, so neighbours bend away, fade and blur with their distance.
export function wheelLayout(distance, { rowHeight, tiltDeg = 6, curve = 1, blur = 2, fade = 0.25, minOpacity = 0.05 } = {}) {
  const tilt = tiltDeg * Math.PI / 180;
  const angle = clamp(distance * tilt, -Math.PI / 2, Math.PI / 2);
  const radius = rowHeight / tilt;
  return {
    x: -radius * (1 - Math.cos(angle)) * curve + 0,
    y: radius * Math.sin(angle) + 0,
    rotate: angle * 180 / Math.PI + 0,
    opacity: Math.max(minOpacity, 1 - Math.abs(distance) * fade),
    blur: Math.abs(distance) * blur,
  };
}

// Page progress through the track (0…1) → wheel position (0…count − 1).
// Every feature owns an equal slice of the track. Inside its slice the wheel
// rests for the middle half and turns to the next one in the other half, so it
// steps from feature to feature instead of drifting.
export function wheelPosition(scrollProgress, count) {
  if (!(count > 1)) return 0;
  const progress = Number.isFinite(scrollProgress) ? clamp(scrollProgress, 0, 1) : 0;
  const raw = clamp(progress * count - 0.5, 0, count - 1);
  const base = Math.floor(raw);
  const turn = clamp((raw - base - 0.25) / 0.5, 0, 1);
  return Math.min(count - 1, base + turn * turn * (3 - 2 * turn));
}

// The progress at which a feature rests in the middle of its slice.
export function wheelProgressFor(index, count) {
  return count > 0 ? clamp((index + 0.5) / count, 0, 1) : 0;
}

// Exponential smoothing with the component's time constant of 200 ms.
export function wheelSmoothing(dtMs) {
  const dt = clamp(dtMs, 0, 50) / 1000;
  return 1 - Math.exp(-dt / 0.2);
}

// Same result as color-mix(in srgb, #fff p%, #a6a6a6) with p = closeness to the centre.
export function wheelColor(distance) {
  const p = Math.max(0, 1 - Math.min(Math.abs(distance), 1));
  const channel = Math.round(166 + (255 - 166) * p);
  return `rgb(${channel}, ${channel}, ${channel})`;
}

// Rows further away than this are invisible anyway (opacity at the floor, outside
// the clipped wheel). Hiding them keeps the number of blurred layers small.
const VISIBLE_ROWS = 6;
const SETTLED = 0.001;
const STYLE_KEYS = ['transform', 'opacity', 'filter', 'color', 'visibility'];

export function mountFeatureWheel(section, { win = window } = {}) {
  const doc = win.document;
  const track = section.querySelector('.wheel-track');
  const stage = section.querySelector('.wheel-stage');
  const list = section.querySelector('.wheel-list');
  const counter = section.querySelector('.wheel-count');
  const items = [...section.querySelectorAll('.wheel-item')];
  const details = [...section.querySelectorAll('.wheel-detail')];
  if (!track || !stage || !list || !items.length) return null;
  const buttons = items.map(item => item.querySelector('button'));
  const count = items.length;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');

  let live = false;
  let near = !win.IntersectionObserver;
  let frame = 0;
  let last = 0;
  let shown = 0;
  let active = -1;
  let rowHeight = 56;
  let blurPerRow = 2;
  let travel = 1;

  const measure = () => {
    rowHeight = (parseFloat(win.getComputedStyle(list).fontSize) || 40) * 1.4;
    const blur = parseFloat(win.getComputedStyle(section).getPropertyValue('--wheel-blur'));
    blurPerRow = Number.isFinite(blur) ? blur : 2;
    travel = Math.max(1, track.offsetHeight - stage.offsetHeight);
  };
  const target = () => wheelPosition(-track.getBoundingClientRect().top / travel, count);

  function markActive(index) {
    if (index === active) return;
    active = index;
    items.forEach((item, i) => {
      const on = i === index;
      item.classList.toggle('is-active', on);
      details[i]?.classList.toggle('is-active', on);
      if (buttons[i]) {
        buttons[i].setAttribute('tabindex', on ? '0' : '-1');
        if (on) buttons[i].setAttribute('aria-current', 'true');
        else buttons[i].removeAttribute('aria-current');
      }
    });
    if (counter) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
  }

  function place(position) {
    items.forEach((item, i) => {
      const distance = i - position;
      const style = item.style;
      if (Math.abs(distance) > VISIBLE_ROWS) {
        if (style.visibility !== 'hidden') style.visibility = 'hidden';
        return;
      }
      const row = wheelLayout(distance, { rowHeight, blur: blurPerRow });
      if (style.visibility) style.removeProperty('visibility');
      style.transform = `translate(${round(row.x)}px, calc(${round(row.y)}px - 50%)) rotate(${round(row.rotate, 3)}deg)`;
      style.opacity = String(round(row.opacity, 3));
      style.filter = row.blur > 0.05 ? `blur(${round(row.blur)}px)` : 'none';
      style.color = wheelColor(distance);
    });
    markActive(clamp(Math.round(position), 0, count - 1));
  }

  function tick(now) {
    frame = 0;
    if (!live || !near) { last = 0; return; }
    let dt = last ? now - last : 16;
    if (!(dt > 0)) dt = 16;
    last = now;
    const goal = target();
    shown += (goal - shown) * wheelSmoothing(dt);
    if (Math.abs(goal - shown) < SETTLED) shown = goal;
    place(shown);
    if (shown !== goal) frame = win.requestAnimationFrame(tick);
    else last = 0;
  }
  const request = () => {
    if (live && near && !frame) frame = win.requestAnimationFrame(tick);
  };
  const snap = () => {
    if (!live) return;
    measure();
    shown = target();
    place(shown);
  };

  function goTo(index, focus) {
    const i = clamp(index, 0, count - 1);
    const top = track.getBoundingClientRect().top + win.scrollY + wheelProgressFor(i, count) * travel;
    win.scrollTo({ top, behavior: 'smooth' });
    if (focus) buttons[i]?.focus({ preventScroll: true });
  }
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  buttons.forEach((button, i) => {
    if (!button) return;
    button.addEventListener('click', () => { if (live) goTo(i, false); });
    button.addEventListener('keydown', (event) => {
      if (!live) return;
      let next;
      if (event.key in keys) next = i + keys[event.key];
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = count - 1;
      else return;
      event.preventDefault();
      goTo(next, true);
    });
  });

  function sync() {
    const allowed = !motion.matches;
    if (frame) { win.cancelAnimationFrame(frame); frame = 0; }
    last = 0;
    if (allowed === live) { snap(); return; }
    live = allowed;
    section.toggleAttribute('data-wheel-live', live);
    if (live) { active = -1; snap(); return; }
    for (const item of items) for (const key of STYLE_KEYS) item.style.removeProperty(key);
    buttons.forEach(button => { button?.removeAttribute('tabindex'); button?.removeAttribute('aria-current'); });
    active = -1;
  }

  win.addEventListener('scroll', request, { passive: true });
  win.addEventListener('resize', () => { if (live) { measure(); request(); } }, { passive: true });
  motion.addEventListener('change', sync);
  // Translated names keep their elements; only a fresh placement is needed.
  doc.addEventListener('novaire:languagechange', () => { if (live) { measure(); place(shown); } });
  if (win.IntersectionObserver) {
    const observer = new win.IntersectionObserver(([entry]) => {
      const was = near;
      near = entry.isIntersecting;
      if (near && !was) { snap(); request(); }
    }, { rootMargin: '120px 0px' });
    observer.observe(track);
  }
  sync();
  return { sync, position: () => shown };
}

if (typeof document !== 'undefined') {
  const section = document.querySelector('.feature-wheel-section');
  if (section) mountFeatureWheel(section);
}
