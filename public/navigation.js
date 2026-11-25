/* Site navigation. No network, storage or tracking.
   index.html: a slim top bar whose panel drops from the top edge (createMenu).
   beta.html keeps its own header with the older glass dropdown (setupGlassMenu). */

const OPEN_LABEL = 'Menü öffnen';
const CLOSE_LABEL = 'Menü schließen';

const isFocusVisible = (element) => {
  try { return element.matches(':focus-visible'); } catch { return true; }
};
const isShown = (element) => !element?.getClientRects || element.getClientRects().length > 0;

/**
 * Top bar menu.
 * Hover (devices that can hover): entering the bar's link area opens the panel; it closes 160 ms after
 * the pointer has left both bar and panel. Keyboard focus in the link area or the panel opens it too.
 * Everywhere: the toggle opens and closes it; a tap outside, Escape and choosing a link close it.
 * The panel's visibility is driven by CSS from `data-open` on the header.
 */
export function createMenu({ header, panel, toggle, canHover = false, doc = globalThis.document, closeDelay = 160, onOpen } = {}) {
  const bar = header.querySelector('.topbar') || header;
  const links = header.querySelector('.topbar-links');
  const hoverable = () => (typeof canHover === 'function' ? canHover() : Boolean(canHover));
  let opened = false;
  let mode = null; // 'hover' | 'focus' | 'click'
  let closeTimer = null;
  let skipFocus = null; // the element that keeps focus after Escape must not reopen the panel at once

  const cancelClose = () => {
    if (closeTimer !== null) clearTimeout(closeTimer);
    closeTimer = null;
  };
  const render = () => {
    toggle.setAttribute('aria-expanded', String(opened));
    toggle.setAttribute('aria-label', opened ? CLOSE_LABEL : OPEN_LABEL);
    if (opened) header.setAttribute('data-open', '');
    else header.removeAttribute('data-open');
  };

  function open(how = 'click') {
    cancelClose();
    if (opened) {
      // A deliberate tap or keyboard focus outranks hover, so a wandering mouse no longer closes the panel.
      if (how !== 'hover') mode = how;
      return;
    }
    opened = true;
    mode = how;
    render();
    onOpen?.();
  }

  function close() {
    cancelClose();
    if (!opened) return;
    opened = false;
    mode = null;
    render();
  }

  const scheduleClose = (event) => {
    if (!opened || mode !== 'hover' || event.pointerType === 'touch') return;
    cancelClose();
    closeTimer = setTimeout(close, closeDelay);
  };

  toggle.addEventListener('click', () => (opened ? close() : open('click')));

  links?.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch' && hoverable()) open('hover');
  });
  for (const zone of new Set([bar, panel])) {
    zone.addEventListener('pointerenter', cancelClose);
    zone.addEventListener('pointerleave', scheduleClose);
  }

  const closeOnLink = (event) => { if (event.target?.closest?.('a')) close(); };
  links?.addEventListener('click', closeOnLink);
  panel.addEventListener('click', closeOnLink);

  header.addEventListener('focusin', (event) => {
    const target = event.target;
    if (target === skipFocus) return;
    skipFocus = null;
    const inMenu = panel.contains(target) || (links && links.contains(target));
    if (inMenu && isFocusVisible(target)) open('focus');
  });
  header.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (next && !header.contains(next)) {
      skipFocus = null;
      close();
    }
  });

  doc?.addEventListener('click', (event) => {
    if (opened && !bar.contains(event.target) && !panel.contains(event.target)) close();
  });
  doc?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !opened) return;
    const active = doc.activeElement;
    close();
    if (active && panel.contains(active)) {
      // The panel is hidden now; put focus back where the visitor can reopen it.
      const fallback = isShown(toggle) ? toggle : links?.querySelector('a');
      skipFocus = fallback;
      fallback?.focus();
    } else if (active && header.contains(active)) {
      skipFocus = active;
    }
  });

  header.setAttribute('data-menu-ready', '');
  return { open, close, isOpen: () => opened };
}

/* Marks the link of the section currently in view with aria-current. */
function markCurrent(links) {
  const local = links.filter((link) => link.pathname === location.pathname && link.hash);
  const destinations = local.map((link) => ({ link, target: document.getElementById(link.hash.slice(1)) }))
    .filter((item) => item.target)
    .sort((a, b) => a.target.offsetTop - b.target.offsetTop);
  const active = destinations.filter(({ target }) => target.getBoundingClientRect().top <= innerHeight * 0.4).at(-1);
  for (const { link } of destinations) {
    if (link === active?.link) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

/* beta.html: the older glass dropdown with its page search. */
function setupGlassMenu(menu) {
  const trigger = menu.querySelector('summary');
  const close = menu.querySelector('.glass-close');
  const search = menu.querySelector('input[type="search"]');
  const groups = [...menu.querySelectorAll('.glass-group')];
  const links = [...menu.querySelectorAll('nav a')];
  const empty = menu.querySelector('.glass-empty');
  if (!trigger || !close || !search || !empty) return;
  const normalize = (text) => text.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const filter = () => {
    const term = normalize(search.value);
    for (const link of links) link.hidden = !normalize(link.textContent).includes(term);
    for (const group of groups) group.hidden = !group.querySelector('a:not([hidden])');
    empty.hidden = groups.some((group) => !group.hidden);
  };

  close.hidden = search.parentElement.hidden = false;
  close.addEventListener('click', () => { menu.open = false; trigger.focus(); });
  menu.addEventListener('toggle', () => {
    if (menu.open) markCurrent(links);
    else { search.value = ''; filter(); menu.querySelector('.glass-links').scrollTop = 0; }
  });
  menu.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
  });
  search.addEventListener('input', filter);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && search.value.trim()) {
      event.preventDefault();
      links.find((link) => !link.hidden)?.click();
    }
  });
  document.addEventListener('novaire:languagechange', filter);
}

if (typeof document !== 'undefined') {
  const header = document.querySelector('.site-header[data-topbar]');
  const panel = document.getElementById('site-panel');
  const toggle = header?.querySelector('.topbar-toggle');
  if (header && panel && toggle) {
    const panelLinks = [...panel.querySelectorAll('a')];
    const hover = matchMedia('(hover: hover) and (pointer: fine)');
    createMenu({ header, panel, toggle, canHover: () => hover.matches, onOpen: () => markCurrent(panelLinks) });
  }
  const glass = document.querySelector('.glass-menu');
  if (glass) setupGlassMenu(glass);
}
