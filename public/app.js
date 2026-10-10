/* No analytics, storage, network calls or external dependencies. */
// A small, deterministic star field is decorative only. Legal and support pages
// do not opt in; creating it never starts a JavaScript animation or resize loop.
if (document.body.classList.contains('seasonal-site')) {
  const stars = document.createElement('div');
  stars.className = 'seasonal-starfield';
  stars.setAttribute('aria-hidden', 'true');
  stars.setAttribute('inert', '');
  stars.setAttribute('data-seasonal-stars', '');
  const fragment = document.createDocumentFragment();
  const colors = ['white', 'white', 'blue', 'white', 'yellow', 'white'];
  for (let i = 0; i < 72; i += 1) {
    const star = document.createElement('span');
    star.className = `seasonal-star seasonal-star-${colors[i % colors.length]}`;
    // Incommensurate sequences spread points without a repeating grid or
    // randomness changing their positions between page visits.
    star.style.setProperty('--star-x', `${((i * 61.803398875 + 8.7) % 100).toFixed(3)}%`);
    star.style.setProperty('--star-y', `${((i * 37.217391304 + 5.1) % 100).toFixed(3)}%`);
    star.style.setProperty('--star-size', `${(i % 9 === 0 ? 1.65 : 0.85 + (i % 4) * 0.2).toFixed(2)}px`);
    star.style.setProperty('--star-opacity', (0.23 + (i % 5) * 0.055).toFixed(3));
    if (i % 6 === 0) {
      star.classList.add('seasonal-star-twinkle');
      star.style.setProperty('--star-duration', `${12 + (i % 5) * 3}s`);
      star.style.setProperty('--star-delay', `${-(i % 11)}s`);
    }
    fragment.append(star);
  }
  stars.append(fragment);
  document.body.prepend(stars);
}

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
if ('IntersectionObserver' in window && !motion.matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('pending');
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08 });
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
