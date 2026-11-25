// Timeline "Von Lenova zu Novaire". The page scrolls normally; nothing is pinned.
// The line fills toward a mark at 60 % of the viewport height, and every chapter whose top
// passes that mark is reached and stays bright. At the closed application round the number
// counts up once. Without JavaScript or with reduced motion everything is simply shown.
import { countUpValue, formatCount } from './count-up.js';

const MARK = 0.6;
const COUNT_MS = 900;
const clamp = (value) => Math.min(1, Math.max(0, value));

// Pure: positions in, progress and reached flags out (viewport coordinates, in px).
export function storyState({ listTop, listHeight, chapterTops, viewportHeight }) {
  const mark = viewportHeight * MARK;
  const progress = listHeight > 0 ? clamp((mark - listTop) / listHeight) : 1;
  return { progress, reached: chapterTops.map(top => top <= mark) };
}

// motion.js calls measure() on load, resize, language and motion changes, update() on scroll.
export function setupStory() {
  const section = document.querySelector('.story-section');
  const list = section?.querySelector('.story-timeline');
  if (!list) return;
  const chapters = [...list.querySelectorAll('.chapter')];
  const count = list.querySelector('.story-count[data-count-to]');
  const countChapter = count?.closest('.chapter');
  const target = Number(count?.dataset.countTo) || 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const language = () => (document.documentElement.lang === 'en' ? 'en' : 'de');
  let live = false, counted = false, frame = 0;

  function showFinal() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (count) count.textContent = formatCount(target, language());
  }
  function runCount() {
    counted = true;
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      count.textContent = formatCount(countUpValue(elapsed, target, COUNT_MS), language());
      frame = elapsed < COUNT_MS ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  }
  function update() {
    if (!live) return;
    const box = list.getBoundingClientRect();
    const { progress, reached } = storyState({
      listTop: box.top, listHeight: box.height, viewportHeight: innerHeight,
      chapterTops: chapters.map(chapter => chapter.getBoundingClientRect().top),
    });
    list.style.setProperty('--story-progress', progress.toFixed(4));
    reached.forEach((isReached, i) => {
      if (!isReached || chapters[i].classList.contains('is-reached')) return;
      chapters[i].classList.add('is-reached');
      if (chapters[i] === countChapter && count && !counted) runCount();
    });
  }
  function measure() {
    const next = !reduced.matches;
    if (next !== live) {
      live = next;
      section.toggleAttribute('data-story-live', live);
      if (!live) {
        chapters.forEach(chapter => chapter.classList.remove('is-reached'));
        list.style.removeProperty('--story-progress');
        counted = true;
      } else if (count && !counted) {
        count.textContent = formatCount(0, language());
      }
    }
    // A finished or skipped count follows the language; a running one picks it up on its next frame.
    if (count && !frame && (counted || !live)) showFinal();
    update();
  }
  return { measure, update };
}
