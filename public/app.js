/* No analytics, storage, network calls or external dependencies. */
const menu = document.querySelector('.menu');
document.addEventListener('click', (event) => {
  if (menu?.open && (!menu.contains(event.target) || event.target.closest('nav a'))) menu.open = false;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});

const motion = matchMedia('(prefers-reduced-motion: reduce)');
// Keep the quiet idle rotation separate from a visitor-requested turn, and
// suspend motion outside the viewport, in background tabs, or for reduced motion.
const brandSymbol = document.querySelector('[data-brand-symbol]');
const brandToggle = document.querySelector('[data-brand-motion-toggle]');
const brandSpinButton = document.querySelector('[data-brand-spin]');
if (brandSymbol && brandToggle) {
  const brandImage = brandSymbol.querySelector('img');
  let manuallyPaused = false;
  let inView = true;
  let brandSpinAnimation = null;
  const cancelBrandSpin = () => {
    brandSpinAnimation?.cancel();
    brandSpinAnimation = null;
  };
  const updateBrandMotion = () => {
    const canAnimate = inView && !document.hidden && !motion.matches;
    brandSymbol.dataset.motionState = !manuallyPaused && canAnimate ? 'running' : 'paused';
    if (!canAnimate) cancelBrandSpin();
    brandToggle.hidden = motion.matches;
    brandToggle.setAttribute('aria-pressed', String(manuallyPaused));
  };
  // The native button also dispatches click for keyboard activation. Ignore
  // repeated activations during a turn so rotations never queue or accumulate.
  brandSpinButton?.addEventListener('click', () => {
    if (brandSpinAnimation || !inView || document.hidden || motion.matches || typeof brandImage?.animate !== 'function') return;
    const animation = brandImage.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', iterations: 1 },
    );
    brandSpinAnimation = animation;
    animation.addEventListener('finish', () => {
      if (brandSpinAnimation === animation) brandSpinAnimation = null;
    }, { once: true });
  });
  brandToggle.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateBrandMotion(); });
  document.addEventListener('visibilitychange', updateBrandMotion);
  motion.addEventListener('change', updateBrandMotion);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateBrandMotion(); });
    observer.observe(brandSymbol);
  }
  updateBrandMotion();
}

if ('IntersectionObserver' in window && !motion.matches) {
  // Blocks that enter the screen together follow each other in quick succession.
  const observer = new IntersectionObserver((entries) => {
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.style.setProperty('--reveal-delay', `${Math.min(order, 4) * 70}ms`);
      order += 1;
      entry.target.classList.remove('pending');
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  for (const element of document.querySelectorAll('.reveal')) {
    element.classList.add('pending');
    observer.observe(element);
  }
  motion.addEventListener('change', (event) => {
    if (!event.matches) return;
    observer.disconnect();
    document.querySelectorAll('.pending').forEach((el) => el.classList.remove('pending'));
  });
}

const dialog = document.querySelector('.image-dialog');
if (dialog && typeof dialog.showModal === 'function') {
  const image = dialog.querySelector('.preview-image');
  let opener;
  for (const link of document.querySelectorAll('[data-preview]')) {
    link.addEventListener('click', (event) => {
      // Keep open-in-new-tab and other standard browser interactions intact.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      image.src = link.href;
      image.alt = link.querySelector('img').alt;
      dialog.querySelector('#preview-title').textContent = link.dataset.title;
      dialog.showModal();
      dialog.querySelector('button').focus();
    });
  }
  dialog.querySelector('.preview-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
}

// Native controls remain usable without JavaScript. Never start a recording
// automatically, and keep only the recording the visitor selected playing.
const demos = [...document.querySelectorAll('.app-demo')];
for (const video of demos) {
  video.addEventListener('play', () => {
    for (const other of demos) if (other !== video) other.pause();
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) for (const video of demos) video.pause();
});
