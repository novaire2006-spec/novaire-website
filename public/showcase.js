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

// Illustrative additional monthly revenue. Free receives a quarter of each extra euro.
const additionalRevenue = [0, 100, 80, 240, 180, 400];
const examples = {
  pro: additionalRevenue.map(euros => euros / 1000 * 100),
  free: additionalRevenue.map(euros => euros * .25 / 500 * 100),
};
const picker = document.querySelector('#peak-month');
const plots = [];
const startX = 10;
const endX = 310;
function position(values, month) {
  return { x: startX + month * (endX - startX) / (values.length - 1), y: 122 - values[month] * 2.5 };
}
function selectMonth(index) {
  picker.value = String(index + 1);
  for (const { values, marker, number } of plots) {
    const point = position(values, index);
    marker.setAttribute('cx', point.x);
    marker.setAttribute('cy', point.y);
    number.textContent = (values[index] ? '+' : '') + values[index] + ' %';
  }
}
if (picker) {
  for (const card of document.querySelectorAll('[data-plan]')) {
    const svg = card.querySelector('.peak-plot');
    const values = examples[card.dataset.plan];
    const points = values.map((_, index) => position(values, index));
    // Horizontal tangents through every sample keep the line inside the measured interval.
    const path = points.slice(1).reduce((line, point, index) => {
      const prev = points[index];
      const mid = (prev.x + point.x) / 2;
      return line + ' C ' + [mid, prev.y, mid, point.y, point.x, point.y].join(' ');
    }, 'M ' + points[0].x + ' ' + points[0].y);
    svg.querySelector('path').setAttribute('d', path);
    const marker = svg.querySelector('circle');
    marker.removeAttribute('visibility');
    plots.push({ values, marker, number: card.querySelector('.peak-number') });
    function inspect(event) {
      const rect = svg.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * 320;
      const month = Math.round((x - startX) / (endX - startX) * (points.length - 1));
      selectMonth(Math.max(0, Math.min(month, points.length - 1)));
    }
    svg.addEventListener('pointerdown', inspect);
    svg.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse' || event.buttons === 1) inspect(event);
    });
  }
  selectMonth(Number(picker.value) - 1);
  picker.addEventListener('change', () => selectMonth(Number(picker.value) - 1));
  picker.parentElement.hidden = false;
}

// Reveal the curves once. Off-screen cards and reduced-motion visits need no animation loop.
const pair = document.querySelector('.peak-pair');
if (pair && !reducedMotion.matches && 'IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      pair.classList.add('peak-reveal');
      reveal.disconnect();
    }
  }, { threshold: .15 });
  reveal.observe(pair);
}

// Without JavaScript, the same four features remain available in document order.
const featureTabs = document.querySelector('.feature-tabs');
if (featureTabs) {
  const buttons = [...featureTabs.querySelectorAll('button')];
  const panels = buttons.map(button => document.getElementById(button.getAttribute('aria-controls')));

  function showFeature(index) {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
  }

  featureTabs.setAttribute('role', 'tablist');
  buttons.forEach((button, i) => {
    button.setAttribute('role', 'tab');
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => showFeature(i));
    button.addEventListener('keydown', event => {
      const next = { Home: 0, End: buttons.length - 1,
        ArrowRight: (i + 1) % buttons.length, ArrowLeft: (i + buttons.length - 1) % buttons.length }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      showFeature(next);
      buttons[next].focus();
    });
  });
  showFeature(0);
  featureTabs.hidden = false;
}
