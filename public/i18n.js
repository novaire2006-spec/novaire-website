import { languageFromSearch, localizedHref, normalizeText, translate } from './i18n-core.js';

let language = languageFromSearch(location.search);
export const getLanguage = () => language;
export const t = (text, locale = language) => translate(text, locale);
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const excluded = 'script,style,noscript,textarea,input,[data-no-translate],[data-language-toggle]';
const attributes = ['alt', 'aria-label', 'placeholder', 'title', 'data-title'];
const observerOptions = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes, 'content', 'href'] };
let changing = false;

function updateText(node) {
  if (node.parentElement?.closest(excluded) || !normalizeText(node.data)) return;
  const previous = originalText.get(node);
  const source = previous && previous.rendered === node.data ? previous.source : node.data;
  const rendered = t(source);
  if (node.data !== rendered) node.data = rendered;
  originalText.set(node, { source, rendered });
}

function updateElement(element) {
  if (element.closest('script,style,noscript,[data-no-translate],[data-language-toggle]')) return;
  let records = originalAttributes.get(element);
  if (!records) { records = new Map(); originalAttributes.set(element, records); }
  const keys = [...attributes];
  if (element.matches('meta[name="description"],meta[property="og:title"],meta[property="og:description"]')) keys.push('content');
  for (const key of keys) {
    if (!element.hasAttribute(key)) continue;
    const current = element.getAttribute(key);
    const previous = records.get(key);
    const source = previous && previous.rendered === current ? previous.source : current;
    const rendered = t(source);
    if (current !== rendered) element.setAttribute(key, rendered);
    records.set(key, { source, rendered });
  }
  if (element.matches('a[href]:not([download])')) {
    const href = element.getAttribute('href');
    const next = localizedHref(href, location.href, language);
    if (next !== href) element.setAttribute('href', next);
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) { updateText(root); return; }
  if (root.nodeType === Node.ELEMENT_NODE) updateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.TEXT_NODE) updateText(walker.currentNode);
    else updateElement(walker.currentNode);
  }
}

// Localize later form validation/status changes without rebuilding the form.
// Input values, checked state, focus, selection and pending requests are untouched.
const observer = new MutationObserver((mutations) => {
  observer.disconnect();
  for (const mutation of mutations) {
    if (mutation.type === 'childList') for (const node of mutation.addedNodes) translateTree(node);
    else if (mutation.type === 'characterData') updateText(mutation.target);
    else updateElement(mutation.target);
  }
  observer.observe(document.documentElement, observerOptions);
});

function renderLanguage() {
  observer.disconnect();
  document.documentElement.lang = language;
  translateTree(document.documentElement);
  for (const button of document.querySelectorAll('[data-language-toggle]')) {
    button.querySelector('[data-language-label]').textContent = language === 'de' ? 'EN' : 'DE';
    button.setAttribute('aria-label', language === 'de' ? 'Auf Englisch wechseln' : 'Switch to German');
    button.setAttribute('lang', language === 'de' ? 'en' : 'de');
    button.hidden = false;
  }
  observer.observe(document.documentElement, observerOptions);
  document.dispatchEvent(new CustomEvent('novaire:languagechange', { detail: { language } }));
}

async function switchLanguage() {
  if (changing) return;
  changing = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  try {
    if (!reduced) {
      root.classList.add('language-changing');
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    language = language === 'de' ? 'en' : 'de';
    const url = new URL(location.href);
    if (language === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    renderLanguage();
  } finally {
    root.classList.remove('language-changing');
    changing = false;
  }
}

for (const button of document.querySelectorAll('[data-language-toggle]')) button.addEventListener('click', switchLanguage);
window.addEventListener('popstate', () => { language = languageFromSearch(location.search); renderLanguage(); });
renderLanguage();
document.documentElement.classList.add('i18n-ready');
