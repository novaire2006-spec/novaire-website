// Draw the projected stars at display resolution. Only the edge of each dot is
// antialiased; there are no scaled textures, blur filters or additive bloom.
const forms = {
  spiral:   { seed: 314, tilt: .88, roll: -.39, arms: 2, twist: 5.3 },
  barred:   { seed: 137, tilt: .68, roll: -.58, arms: 2, twist: 4.6 },
  sombrero: { seed: 259, tilt: 1.26, roll: -.20, arms: 3, twist: 4.7 },
};
const tau = Math.PI * 2;
const inks = [
  '#9aa6bf65', '#b9c4dd92', '#d5deedbc', '#edf2faed', '#ffffff',
  '#c7b5a282', '#e9d2b8cb', '#fff1dfef',
];

function makeStars(kind, small) {
  const form = forms[kind];
  let seed = form.seed;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(tau * random());
  const groups = inks.map(() => []);
  const count = small ? 200 : 1780;
  for (let i = 0; i < count; i++) {
    const core = random() < .14;
    const halo = !core && random() < .19;
    const r = core ? Math.abs(normal()) * .052 : .028 + .405 * Math.pow(random(), .85);
    const arm = Math.floor(random() * form.arms);
    const thread = random() < .36 ? .17 : -.09;
    let angle = arm * tau / form.arms + form.twist * Math.log(1 + 5.8 * r)
      + thread + .10 * Math.sin(17 * r + arm) + normal() * (.082 + .24 * r);
    if (core || halo) angle = tau * random();
    const x = Math.cos(angle) * r;
    let y = Math.sin(angle) * r;
    if (kind === 'barred' && r < .16) y *= .34 + 3.8 * r;
    const z = normal() * (core ? .030 : halo ? .023 : .009);
    const brightness = random();
    const warm = core || (kind === 'sombrero' && random() < .65);
    let ink = warm ? (brightness < .53 ? 5 : brightness < .92 ? 6 : 7)
      : (brightness < .37 ? 1 : brightness < .82 ? 2 : brightness < .975 ? 3 : 4);
    // Thin out the tips, so the silhouette dissolves into individual stars.
    if (halo || (r > .34 && random() < (r - .34) * 8)) ink = brightness < .7 ? 0 : 1;
    const radius = (.00135 + .00195 * brightness ** 2 + (ink === 4 ? .00145 : 0)) * (core ? .83 : 1);
    groups[ink].push({ x, y, z, radius, dx: 0, dy: 0, wakeX: 0, wakeY: 0 });
  }
  return groups;
}

export function createGalaxy(canvas, kind, small = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const form = forms[kind];
  const groups = makeStars(kind, small);
  let previous, clock = 0, settling = 0;
  const strokes = [];

  function disturb(x, y, fromX = x, fromY = y) {
    const sx = x - fromX, sy = y - fromY;
    const length2 = sx * sx + sy * sy;
    const length = Math.sqrt(length2);
    const stroke = { ax: fromX, ay: fromY, sx, sy, length2,
      dirX: length ? sx / length : 0, dirY: length ? sy / length : 0 };
    // At very high event rates retain the last endpoint of this frame's path.
    if (strokes.length >= 12) {
      const prior = strokes.pop();
      stroke.ax = prior.ax; stroke.ay = prior.ay;
      stroke.sx = x - prior.ax; stroke.sy = y - prior.ay;
      stroke.length2 = stroke.sx ** 2 + stroke.sy ** 2;
    }
    strokes.push(stroke);
  }

  function draw(now, pixels, still = false) {
    const dt = Math.min(.05, Math.max(0, (now - (previous ?? now)) / 1000));
    previous = now;
    if (!still) clock += dt;
    if (canvas.width !== pixels || canvas.height !== pixels) canvas.width = canvas.height = pixels;
    ctx.clearRect(0, 0, pixels, pixels);
    const tilt = form.tilt + .021 * Math.sin(clock * .12);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const cr = Math.cos(form.roll), sr = Math.sin(form.roll);
    const cs = Math.cos(clock * .028), sn = Math.sin(clock * .028);
    const brush = small ? .21 : .132;
    const brush2 = brush * brush;
    if (strokes.length) settling = 2;
    const moving = !still && settling > 0;
    const follow = 1 - Math.exp(-18 * dt);
    const decay = Math.exp(-4.7 * dt);
    for (const [ink, stars] of groups.entries()) {
      ctx.fillStyle = inks[ink];
      ctx.beginPath();
      for (const star of stars) {
        const x = star.x * cs - star.y * sn, y = star.x * sn + star.y * cs;
        const depth = y * st + star.z * ct;
        const vertical = y * ct - star.z * st;
        const perspective = 1.85 / (1.85 - depth);
        const hx = .5 + (x * cr - vertical * sr) * perspective;
        const hy = .5 + (x * sr + vertical * cr) * perspective;
        // A narrow foreground dust lane separates the Sombrero's disk and bulge.
        if (kind === 'sombrero' && depth < .035 && Math.abs(vertical - .018) < .009) continue;
        if (moving) {
          star.wakeX *= decay; star.wakeY *= decay;
          let nearest = brush2;
          for (const stroke of strokes) {
            const ox = hx - stroke.ax, oy = hy - stroke.ay;
            const along = stroke.length2 ? Math.min(1, Math.max(0, (ox * stroke.sx + oy * stroke.sy) / stroke.length2)) : 0;
            const rx = ox - along * stroke.sx, ry = oy - along * stroke.sy;
            const distance2 = rx * rx + ry * ry;
            if (distance2 >= nearest) continue;
            nearest = distance2;
            const distance = Math.sqrt(distance2);
            const weight = (1 - distance / brush) ** 2;
            const push = brush * weight * (.72 + depth * .48);
            const divisor = Math.max(.0035, distance);
            star.wakeX = push * (rx / divisor + .39 * stroke.dirX);
            star.wakeY = push * (ry / divisor + .39 * stroke.dirY);
          }
          star.dx += (star.wakeX - star.dx) * follow;
          star.dy += (star.wakeY - star.dy) * follow;
        } else {
          star.dx = star.dy = star.wakeX = star.wakeY = 0;
        }
        const px = (hx + star.dx) * pixels, py = (hy + star.dy) * pixels;
        const size = Math.max(small ? .56 : .48, pixels * star.radius * perspective * (small ? 3 : 1));
        ctx.moveTo(px + size, py);
        ctx.arc(px, py, size, 0, tau);
      }
      ctx.fill();
    }
    strokes.length = 0;
    settling = still ? 0 : Math.max(0, settling - dt);
    if (!canvas.classList.contains('is-rendered')) canvas.classList.add('is-rendered');
  }
  return { draw, disturb };
}

export function galaxyGestures(region, visibleModels) {
  let last = null;
  function sweep(x, y) {
    const from = last ?? { x, y };
    if (last && last.x === x && last.y === y) return;
    last = { x, y };
    for (const { canvas, model } of visibleModels()) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || Math.max(x,from.x) < r.left || Math.min(x,from.x) > r.right ||
          Math.max(y,from.y) < r.top || Math.min(y,from.y) > r.bottom) continue;
      model.disturb((x-r.left)/r.width, (y-r.top)/r.height, (from.x-r.left)/r.width, (from.y-r.top)/r.height);
    }
  }
  const reset = () => { last = null; };
  for (const type of ['pointerleave', 'pointercancel', 'touchend', 'touchcancel']) {
    region.addEventListener(type, reset, { passive: true });
  }
  for (const type of ['pointerdown','pointermove']) {
    region.addEventListener(type, event => {
      if (event.pointerType === 'touch' || !event.isPrimary) return;
      if (type === 'pointerdown') reset();
      sweep(event.clientX, event.clientY);
    }, { passive: true });
  }
  for (const type of ['touchstart', 'touchmove']) {
    region.addEventListener(type, event => {
      if (type === 'touchstart' || event.touches.length !== 1) reset();
      if (event.touches.length === 1) sweep(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: true });
  }
}

const motion = matchMedia('(prefers-reduced-motion: reduce)');
for (const region of document.querySelectorAll('.universe-orbits, .plate-community')) {
  const small = region.matches('.universe-orbits');
  const models = [...region.querySelectorAll('[data-galaxy]')].map(canvas => ({
    canvas, model: createGalaxy(canvas, canvas.dataset.galaxy, small),
  })).filter(item => item.model);
  if (!models.length) continue;
  let near = false, frame = 0, last = 0;
  function tick(now) {
    frame = 0;
    if (!near || document.hidden || (region.matches('.plate-community') && !region.classList.contains('is-active'))) return;
    if (now - last >= 32 || motion.matches) {
      for (const {canvas, model} of models) {
        const px = Math.ceil(canvas.clientWidth * Math.min(devicePixelRatio || 1, 3));
        if (px) model.draw(now, px, motion.matches);
      }
      last = now;
    }
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }
  function resume() { cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); }
  galaxyGestures(small ? region : region.parentElement, () => near && !motion.matches && (small || region.classList.contains('is-active')) ? models : []);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {near = entry.isIntersecting; resume();}).observe(region);
  else {near = true; resume();}
  if (!small) new MutationObserver(resume).observe(region, { attributes: true, attributeFilter: ['class'] });
  if ('ResizeObserver' in window) new ResizeObserver(resume).observe(region);
  motion.addEventListener('change', resume);
  document.addEventListener('visibilitychange', resume);
}
