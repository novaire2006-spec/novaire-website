/* Scroll state for the header and the story line. No network, storage or tracking. */
(() => {
  const root = document.documentElement;
  const timeline = document.querySelector('.story-timeline');
  const steps = timeline ? [...timeline.children] : [];
  let queued = false;

  const update = () => {
    queued = false;
    root.classList.toggle('at-top', window.scrollY < 12);
    if (!timeline) return;
    // The line is drawn down to a reading line a little below the middle of the screen.
    const mark = window.innerHeight * 0.62;
    const box = timeline.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (mark - box.top) / Math.max(1, box.height)));
    timeline.style.setProperty('--progress', progress.toFixed(4));
    for (const step of steps) step.classList.toggle('is-reached', step.getBoundingClientRect().top + 8 < mark);
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  root.classList.add('motion-ready');
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();
