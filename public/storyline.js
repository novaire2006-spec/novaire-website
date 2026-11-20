// The document owns the scroll. The sticky frame simply presents the chapter at this position.
export function setupStory() {
  const run = document.querySelector('.story-run');
  if (!run) return;
  const frame = run.querySelector('.story-frame');
  const chapters = [...run.querySelectorAll('[data-chapter]')];
  const plates = [...run.querySelectorAll('.chapter-plate')];
  const controls = run.querySelector('.chapter-controls');
  const [previous, next] = controls.querySelectorAll('button');
  const count = controls.querySelector('.chapter-count');
  const status = controls.querySelector('[data-chapter-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const last = chapters.length - 1;
  let current = -1, pinTop = 0, stride = 0, enabled = false;
  if (last < 1 || plates.length !== chapters.length) return;

  function display(index) {
    if (index === current) return;
    current = index;
    chapters.forEach((chapter, i) => {
      chapter.classList.toggle('is-active', i === index);
      plates[i].classList.toggle('is-active', i === index);
    });
    count.textContent = [index + 1, last + 1].map(n => String(n).padStart(2, '0')).join(' / ');
    previous.setAttribute('aria-disabled', String(index === 0));
    next.setAttribute('aria-disabled', String(index === last));
  }
  function update() {
    if (!enabled) return;
    const position = Math.max(0, Math.min(last, (pinTop - run.getBoundingClientRect().top) / stride));
    run.style.setProperty('--chapter-progress', ((position + 1) / chapters.length).toFixed(4));
    display(Math.round(position));
  }
  function measure() {
    pinTop = Math.max(76, Math.round(innerHeight * .14));
    stride = Math.min(390, Math.max(190, Math.round(innerHeight * .42)));
    run.style.setProperty('--story-top', pinTop + 'px');
    run.style.setProperty('--story-distance', (stride * last) + 'px');
    enabled = !reduced.matches && innerHeight >= 510;
    run.toggleAttribute('data-scroll-story', enabled);
    controls.hidden = !enabled;
    if (enabled && frame.offsetHeight + pinTop + 16 > innerHeight) {
      enabled = false;
      run.removeAttribute('data-scroll-story');
      controls.hidden = true;
    }
    if (enabled) update();
    else display(0);
  }
  function jump(index) {
    if (!enabled || index < 0 || index > last) return;
    window.scrollTo({ top: scrollY + run.getBoundingClientRect().top - pinTop + index * stride, behavior: 'instant' });
    update();
    status.textContent = chapters[index].querySelector('h3').textContent;
  }
  previous.addEventListener('click', () => jump(current - 1));
  next.addEventListener('click', () => jump(current + 1));
  return { measure, update };
}
