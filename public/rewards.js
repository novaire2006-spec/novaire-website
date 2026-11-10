/* Rewards scene: the app's own galaxy and black-hole shaders on a local WebGL canvas.
   A galaxy comes out of the star field while the page scrolls. No network, storage or tracking. */
import { galaxySource, blackHoleSource } from './universe-shaders.js';

const section = document.querySelector('.rewards-section');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (section && !motion.matches) start();

function start() {
  const track = section.querySelector('.rewards-track');
  const stage = section.querySelector('.rewards-stage');
  const surface = document.createElement('canvas');
  const gl = surface.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl || !track || !stage) return;

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const span = (value, from, to) => clamp((value - from) / (to - from));
  const smooth = (value) => value * value * (3 - 2 * value);
  const sky = window.novaireSky = window.novaireSky || { travel: 0 };

  const body = (name, seed, param) => {
    const canvas = section.querySelector(`[data-body="${name}"]`);
    return { canvas, context: canvas.getContext('2d'), seed, param, scale: 0, alpha: 0, x: 0 };
  };
  const galaxy = body('galaxy', 314, 46);
  const hole = body('blackhole', 42, 9);
  const friend = body('friend', 137, 55);
  const bodies = [galaxy, hole, friend];
  const captions = [...section.querySelectorAll('.rewards-caption')];
  const labels = [...section.querySelectorAll('.rewards-label')];
  const kinds = [...section.querySelectorAll('.rarity-scale li')];

  // One triangle covers the canvas; each object is a fragment shader.
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertex, '#version 300 es\nin vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }');
  gl.compileShader(vertex);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const compile = (source) => {
    const fragment = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragment, source);
    gl.compileShader(fragment);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    const uniform = (name) => gl.getUniformLocation(program, name);
    return {
      program, size: uniform('uSize'), time: uniform('uTime'), seed: uniform('uSeed'), param: uniform('uParam'),
      background: uniform('uBackground'), zoom: uniform('uZoom'), ratio: uniform('uDpr'), view: uniform('uView'), spin: uniform('uSpin'),
    };
  };

  let galaxyProgram = null;
  let holeProgram = null;
  let ready = false;
  let lost = false;
  let size = 0;
  let width = 0;
  let height = 0;
  let quality = 1.5;
  let slow = 0;
  let last = 0;
  let frame = 0;
  let near = false;
  let progress = -1;

  const measure = () => {
    size = galaxy.canvas.clientWidth;
    width = stage.clientWidth;
    height = stage.clientHeight;
  };

  // An object approaches from far away, rests, then flies past the viewer.
  const approach = (p, start, arrive, leave, gone) => {
    if (p <= start || p >= gone) return { scale: 0, alpha: 0 };
    if (p < arrive) {
      const closer = smooth((p - start) / (arrive - start));
      return { scale: Math.pow(0.012, 1 - closer), alpha: Math.min(1, closer / 0.1) };
    }
    if (p < leave) return { scale: 1 + 0.05 * (p - arrive) / (leave - arrive), alpha: 1 };
    const out = (p - leave) / (gone - leave);
    return { scale: 1.05 + out * out * 1.9, alpha: 1 - smooth(out) };
  };

  const place = (p) => {
    const pair = Math.min(0.6, (width * 0.4) / Math.max(1, size));
    const aside = Math.min(width * 0.24, size * 0.4);
    const meet = smooth(span(p, 0.76, 0.92));
    if (p < 0.6) {
      Object.assign(galaxy, approach(p, 0.02, 0.26, 0.38, 0.47), { x: 0 });
      Object.assign(friend, { scale: 0, alpha: 0, x: 0 });
    } else {
      const state = meet > 0 ? { scale: Math.pow(0.012, 1 - meet) * pair, alpha: Math.min(1, meet / 0.1) } : { scale: 0, alpha: 0 };
      Object.assign(galaxy, state, { x: -aside * meet });
      Object.assign(friend, state, { x: aside * meet });
    }
    Object.assign(hole, approach(p, 0.42, 0.6, 0.71, 0.79), { x: 0 });

    for (const item of bodies) {
      item.canvas.style.opacity = item.alpha.toFixed(3);
      item.canvas.style.transform = `translate3d(${item.x.toFixed(1)}px, 0, 0) scale(${Math.max(0.001, item.scale).toFixed(4)})`;
    }
    const windows = [[0.17, 0.25, 0.36, 0.41], [0.53, 0.6, 0.7, 0.74], [0.86, 0.93, 2, 3]];
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
    sky.travel = p * 1.5;
  };

  const paint = (item, program, seconds, spin) => {
    if (!program || item.alpha < 0.004 || item.scale <= 0) return;
    const shown = size * item.scale;
    const ratio = Math.min(window.devicePixelRatio || 1, quality);
    const pixels = Math.min(1536, Math.ceil(Math.min(size, Math.max(48, shown * 1.15)) * ratio / 32) * 32);
    if (item.canvas.width !== pixels) item.canvas.width = item.canvas.height = pixels;
    if (surface.width < pixels) surface.width = surface.height = Math.min(1536, Math.ceil(pixels / 256) * 256);
    gl.viewport(0, 0, pixels, pixels);
    gl.useProgram(program.program);
    gl.uniform2f(program.size, size, size);
    gl.uniform1f(program.time, seconds);
    gl.uniform1f(program.seed, item.seed);
    gl.uniform1f(program.param, item.param);
    gl.uniform1f(program.background, 0);
    gl.uniform1f(program.zoom, Math.min(3, Math.max(1, shown / 110)));
    gl.uniform1f(program.ratio, pixels / size);
    gl.uniform3f(program.view, 0, 0, size);
    if (program.spin) gl.uniform1f(program.spin, spin);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    item.context.clearRect(0, 0, pixels, pixels);
    item.context.drawImage(surface, 0, surface.height - pixels, pixels, pixels, 0, 0, pixels, pixels);
  };

  const render = (now) => {
    const box = track.getBoundingClientRect();
    const view = window.innerHeight;
    const p = clamp((view * 0.3 - box.top) / Math.max(1, box.height - view * 0.7));
    if (p !== progress) { progress = p; place(p); }
    if (!ready || lost || !size) return;
    // Ease the resolution down on devices that cannot keep up.
    if (last && now - last > 30) slow += 1; else slow = Math.max(0, slow - 1);
    if (slow > 24 && quality > 0.8) { quality -= 0.25; slow = 0; }
    last = now;
    const seconds = now / 1000;
    const spin = seconds * 0.16 + p * 5;
    paint(galaxy, galaxyProgram, seconds, spin);
    paint(friend, galaxyProgram, seconds + 40, spin * 0.8 + 2);
    paint(hole, holeProgram, seconds * 1.4, 0);
  };
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    render(now);
  };
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (near && !document.hidden) frame = requestAnimationFrame(tick);
    else render(performance.now());
  };

  section.classList.add('rewards-live');
  measure();
  render(performance.now());

  // Compile after the first paint so the page opens without a pause.
  const prepare = () => {
    galaxyProgram = compile(galaxySource);
    if (!galaxyProgram) { section.classList.remove('rewards-live'); sky.travel = 0; cancelAnimationFrame(frame); return; }
    holeProgram = compile(blackHoleSource);
    ready = true;
  };
  if ('requestIdleCallback' in window) requestIdleCallback(prepare, { timeout: 1500 });
  else setTimeout(prepare, 600);

  surface.addEventListener('webglcontextlost', (event) => { event.preventDefault(); lost = true; });
  window.addEventListener('resize', () => { measure(); progress = -1; render(performance.now()); });
  window.addEventListener('scroll', () => { if (!frame) render(performance.now()); }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { near = entry.isIntersecting; sync(); }, { rootMargin: '25% 0px' }).observe(track);
  } else {
    near = true;
    sync();
  }
}
