import { en } from './translations-en.js';

export const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();
export const languageFromSearch = (search) => new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'de';
export function translate(text, language) {
  if (language !== 'en') return text;
  const replacement = en[normalizeText(text)];
  if (replacement === undefined) return text;
  const leading = /^[.,;:!?]/.test(replacement) ? '' : text.match(/^\s*/)[0];
  return leading + replacement + text.match(/\s*$/)[0];
}

// Language travels with page links, not a cookie or a persistent browser store.
// Downloads, preview images, external links and in-page anchors stay untouched.
export function localizedHref(href, base, language) {
  if (!href || href.startsWith('#')) return href;
  let url;
  try { url = new URL(href, base); } catch { return href; }
  if (url.origin !== new URL(base).origin || !/^https?:$/.test(url.protocol)) return href;
  if (/\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith('.html')) return href;
  if (language === 'en') url.searchParams.set('lang', 'en');
  else url.searchParams.delete('lang');
  return url.pathname + url.search + url.hash;
}
