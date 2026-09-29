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
