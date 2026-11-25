// Fine particles for the launch countdown: the old digits dissolve where they stood,
// drift up and outward and fade. No gravity, no bounce. One shared loop that stops
// as soon as nothing is alive.

export const MAX_PARTICLES = 220; // per burst
export const PARTICLE_LIFETIME = 700; // ms, from the burst until the last particle is gone

const POOL = MAX_PARTICLES * 2; // seconds and minutes can change in the same tick
const SAMPLE_STEP = 2; // CSS px between sampled glyph pixels
const MAX_DELAY = 140; // ms: the top of a digit lets go a little before its foot
const DRAG = 1.6; // per second, eases the drift out instead of stopping hard
const CACHE_LIMIT = 96;

const resolve = (value) => (typeof value === 'function' ? value() : value);

export function createDigitBurst(canvas, { reducedMotion = false, maxParticles = MAX_PARTICLES } = {}, env = {}) {
  const requestFrame = env.requestAnimationFrame ?? globalThis.requestAnimationFrame?.bind(globalThis);
  const cancelFrame = env.cancelAnimationFrame ?? globalThis.cancelAnimationFrame?.bind(globalThis);
  const random = env.random ?? Math.random;

  // A fixed preference never allocates anything or touches the canvas.
  if (reducedMotion === true || !canvas || !requestFrame) return { burst: () => 0, stop() {} };

  const x = new Float32Array(POOL);
  const y = new Float32Array(POOL);
  const vx = new Float32Array(POOL);
  const vy = new Float32Array(POOL);
  const age = new Float32Array(POOL);
  const delay = new Float32Array(POOL);
  const size = new Float32Array(POOL);
  const alpha = new Float32Array(POOL);
  const colour = new Array(POOL).fill('');
  const glyphs = new Map();
  let alive = 0;
  let context = null;
  let scratch = null;
  let frame = 0;
  let last = -1;
  let width = 0;
  let height = 0;

  function prepare() {
    if (!context) context = canvas.getContext('2d');
    if (!context) return false;
    const ratio = Math.min(2, env.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(pixelWidth / Math.max(1, width), 0, 0, pixelHeight / Math.max(1, height), 0, 0);
    return width > 0 && height > 0;
  }

  function scratchCanvas(w, h) {
    if (!scratch) {
      scratch = env.createCanvas?.(w, h)
        ?? (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : globalThis.document?.createElement('canvas'));
      if (!scratch) return null;
    }
    if (scratch.width < w) scratch.width = w;
    if (scratch.height < h) scratch.height = h;
    return scratch;
  }

  // Opaque glyph pixels of `text`, laid out like the DOM value: centred, tabular digits,
  // the line box as tall as the font size. Coordinates are relative to the value's box.
  function sample(text, boxWidth, boxHeight, font, letterSpacing) {
    const key = `${text}|${font}|${letterSpacing}|${Math.round(boxWidth)}x${Math.round(boxHeight)}`;
    const cached = glyphs.get(key);
    if (cached) return cached;
    const pad = Math.ceil(boxHeight * 0.25);
    const w = Math.ceil(boxWidth) + pad * 2;
    const h = Math.ceil(boxHeight) + pad * 2;
    const surface = scratchCanvas(w, h);
    const pen = surface?.getContext('2d', { willReadFrequently: true });
    if (!pen) return new Float32Array(0);
    pen.clearRect(0, 0, surface.width, surface.height);
    pen.font = font;
    pen.fillStyle = '#fff';
    pen.textAlign = 'center';
    pen.textBaseline = 'alphabetic';
    if ('letterSpacing' in pen) pen.letterSpacing = '0px';
    const zero = pen.measureText('0');
    const ascent = zero.fontBoundingBoxAscent ?? boxHeight * 0.8;
    const descent = zero.fontBoundingBoxDescent ?? boxHeight * 0.2;
    // line-height: 1 → half-leading splits the gap between font box and line box.
    const baseline = pad + (boxHeight - (ascent + descent)) / 2 + ascent;
    const characters = [...text];
    const slot = zero.width + letterSpacing;
    // The DOM run includes trailing letter-spacing and is centred as a whole.
    const runStart = pad + boxWidth / 2 - (characters.length * slot) / 2;
    characters.forEach((character, index) => pen.fillText(character, runStart + index * slot + zero.width / 2, baseline));
    const { data } = pen.getImageData(0, 0, w, h);
    const points = [];
    for (let row = 0; row < h; row += SAMPLE_STEP) {
      for (let column = 0; column < w; column += SAMPLE_STEP) {
        if (data[(row * w + column) * 4 + 3] > 110) points.push(column - pad, row - pad);
      }
    }
    if (glyphs.size >= CACHE_LIMIT) glyphs.clear();
    const result = Float32Array.from(points);
    glyphs.set(key, result);
    return result;
  }

  function burst(text, rect, font, color, { letterSpacing = 0 } = {}) {
    if (!text || !rect || resolve(reducedMotion)) return 0;
    if (!prepare()) return 0;
    const points = sample(String(text), rect.width, rect.height, font, letterSpacing);
    const total = points.length / 2;
    const cap = Math.min(MAX_PARTICLES, Math.max(0, Math.floor(resolve(maxParticles) ?? MAX_PARTICLES)), POOL - alive);
    const count = Math.min(total, cap);
    if (!count) return 0;
    const centre = rect.x + rect.width / 2;
    const half = Math.max(1, rect.width / 2);
    for (let k = 0; k < count; k += 1) {
      // Evenly spread over the glyph, so a capped burst still reads as the whole digit.
      const source = Math.min(total - 1, Math.floor(((k + random()) * total) / count));
      const px = rect.x + points[source * 2] + random() * SAMPLE_STEP;
      const py = rect.y + points[source * 2 + 1] + random() * SAMPLE_STEP;
      const outward = Math.max(-1, Math.min(1, (px - centre) / half));
      const slot = alive;
      x[slot] = px;
      y[slot] = py;
      vx[slot] = outward * (10 + random() * 30) + (random() - 0.5) * 12;
      vy[slot] = -(18 + random() * 38);
      age[slot] = 0;
      delay[slot] = Math.max(0, Math.min(1, (py - rect.y) / rect.height)) * (MAX_DELAY - 40) + random() * 40;
      size[slot] = 0.9 + random() * 0.9;
      alpha[slot] = 0.55 + random() * 0.45;
      colour[slot] = color;
      alive += 1;
    }
    if (!frame) {
      last = -1;
      frame = requestFrame(step);
    }
    return count;
  }

  function remove(index) {
    const end = alive - 1;
    if (index !== end) {
      x[index] = x[end]; y[index] = y[end];
      vx[index] = vx[end]; vy[index] = vy[end];
      age[index] = age[end]; delay[index] = delay[end];
      size[index] = size[end]; alpha[index] = alpha[end];
      colour[index] = colour[end];
    }
    alive = end;
  }

  function step(time) {
    frame = 0;
    const dt = last < 0 ? 16 : Math.min(50, Math.max(0, time - last));
    last = time;
    const seconds = dt / 1000;
    const drag = Math.exp(-DRAG * seconds);
    context.clearRect(0, 0, width, height);
    let fill = '';
    let index = 0;
    while (index < alive) {
      age[index] += dt;
      if (age[index] >= PARTICLE_LIFETIME) { remove(index); continue; }
      let opacity = alpha[index];
      if (age[index] > delay[index]) {
        vx[index] *= drag;
        vy[index] *= drag;
        x[index] += vx[index] * seconds;
        y[index] += vy[index] * seconds;
        const t = (age[index] - delay[index]) / (PARTICLE_LIFETIME - delay[index]);
        opacity *= (1 - t) * (1 - t);
      }
      if (colour[index] !== fill) { fill = colour[index]; context.fillStyle = fill; }
      context.globalAlpha = opacity;
      const s = size[index];
      context.fillRect(x[index] - s / 2, y[index] - s / 2, s, s);
      index += 1;
    }
    context.globalAlpha = 1;
    if (alive) frame = requestFrame(step);
  }

  function stop() {
    if (frame) cancelFrame?.(frame);
    frame = 0;
    alive = 0;
    context?.clearRect(0, 0, width, height);
  }

  return { burst, stop };
}
