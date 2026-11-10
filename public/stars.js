/* Decorative night sky. A local canvas only: no network, storage or tracking. */
(() => {
  if (matchMedia('(prefers-contrast: more)').matches || matchMedia('(forced-colors: active)').matches) return;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.className = 'star-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  // White, blue, yellow and red stars. Shares add up to one.
  const palette = [
    { rgb: '255,255,255', share: 0.42 },
    { rgb: '126,172,255', share: 0.22 },
    { rgb: '255,212,106', share: 0.20 },
    { rgb: '255,118,104', share: 0.16 },
  ];
  const maxStars = 340;
  const edge = 24;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Another script may set travel to let the stars flow past, as on a flight forwards.
  const sky = window.novaireSky = window.novaireSky || { travel: 0 };

  // A fixed seed keeps the same sky on every page and every visit.
  let seed = 20261110;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const stars = Array.from({ length: maxStars }, () => {
    let pick = random();
    let color = 0;
    while (color < palette.length - 1 && pick > palette[color].share) pick -= palette[color++].share;
    const depth = random();
    const radius = (color === 0 ? 0.4 : 0.68) + depth ** 2.4 * 1.05;
    return {
      x: random(),
      y: random(),
      color,
      radius,
      alpha: (color === 0 ? 0.34 : 0.62) + depth * 0.38,
      drift: 0.025 + depth * 0.095,
      halo: radius > 1.12 ? radius * 4.6 : 0,
      twinkle: random() < 0.45,
      speed: 0.35 + random() * 1.1,
      phase: random() * Math.PI * 2,
      lane: random(),
      pace: 0.6 + depth * 0.8,
    };
  });

  // One soft halo per colour, drawn once and reused for the brightest stars.
  const halos = palette.map(({ rgb }) => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const paint = sprite.getContext('2d');
    const gradient = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${rgb},.55)`);
    gradient.addColorStop(0.35, `rgba(${rgb},.14)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    paint.fillStyle = gradient;
    paint.fillRect(0, 0, 64, 64);
    return sprite;
  });
  const fills = palette.map(({ rgb }) => `rgb(${rgb})`);

  let width = 0;
  let height = 0;
  let count = 0;
  let unit = 1;
  let frame = 0;
  let lastDraw = 0;
  let lastScroll = -1;

  const draw = (time, scroll) => {
    const field = height + edge * 2;
    const animated = !motion.matches;
    const travel = animated ? sky.travel || 0 : 0;
    const blend = Math.min(1, travel * 6);
    context.clearRect(0, 0, width, height);
    for (let index = 0; index < count; index += 1) {
      const star = stars[index];
      let y = (star.y * field - (animated ? scroll * star.drift : 0)) % field;
      if (y < 0) y += field;
      y -= edge;
      let x = star.x * width;
      let alpha = star.alpha;
      if (travel) {
        // Each star moves outwards from the middle and starts again further in, so the sky stays full.
        const cycle = star.lane + travel * star.pace;
        const turn = cycle - Math.floor(cycle);
        const zoom = 1 + (turn - star.lane) * 0.8;
        x = width / 2 + (x - width / 2) * zoom;
        y = height / 2 + (y - height / 2) * zoom;
        alpha *= 1 - blend * (1 - Math.min(1, turn / 0.12, (1 - turn) / 0.12));
      }
      if (animated && star.twinkle) alpha *= 0.6 + 0.4 * Math.sin(time * star.speed + star.phase);
      if (star.halo) {
        const halo = star.halo * unit;
        context.globalAlpha = alpha * 0.6;
        context.drawImage(halos[star.color], x - halo, y - halo, halo * 2, halo * 2);
      }
      context.globalAlpha = alpha;
      context.fillStyle = fills[star.color];
      context.beginPath();
      context.arc(x, y, star.radius * unit, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const nextWidth = Math.round(box.width);
    const nextHeight = Math.round(box.height);
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return;
    width = nextWidth;
    height = nextHeight;
    // Dots are drawn at two device pixels per point or more, so they stay fine and smooth on every
    // screen, within a budget of about nine million pixels. On narrow screens they are smaller.
    const wanted = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const ratio = Math.max(1, Math.min(wanted, Math.sqrt(9e6 / (width * height))));
    unit = Math.min(1, Math.max(0.6, width / 760));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    count = Math.max(90, Math.min(maxStars, Math.round((width * height) / 5200)));
    lastScroll = -1;
    draw(performance.now() / 1000, window.scrollY);
  };

  // Follow the scroll every frame, but let the idle twinkle run at a calm pace.
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    const scroll = window.scrollY + (sky.travel || 0) * 1e6;
    if (scroll === lastScroll && now - lastDraw < 50) return;
    lastDraw = now;
    lastScroll = scroll;
    draw(now / 1000, window.scrollY);
  };
  const update = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (document.hidden) return;
    if (motion.matches) draw(0, 0);
    else frame = requestAnimationFrame(tick);
  };

  window.addEventListener('resize', resize);
  // The canvas can change size without a window resize, for example when a phone turns.
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  resize();
  update();
  requestAnimationFrame(() => document.documentElement.classList.add('stars-ready'));
})();
