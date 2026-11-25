// Both tracks use one accessible list. The duplicate only supplies the visual loop.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.toggleAttribute('data-away', !entry.isIntersecting);
    })
  : null;

for (const surface of document.querySelectorAll('[data-showcase-motion]')) {
  const belt = surface.querySelector('.provider-belt');
  function configure() {
    surface.toggleAttribute('data-animated', !reducedMotion.matches);
    if (!belt) return;
    if (reducedMotion.matches) {
      belt.querySelector('.provider-list[aria-hidden]')?.remove();
      surface.removeAttribute('data-marquee');
    } else if (!surface.hasAttribute('data-marquee')) {
      const duplicate = belt.firstElementChild.cloneNode(true);
      duplicate.setAttribute('aria-hidden', 'true');
      belt.append(duplicate);
      surface.setAttribute('data-marquee', '');
    }
  }
  reducedMotion.addEventListener('change', configure);
  configure();
  observer?.observe(surface);
}


