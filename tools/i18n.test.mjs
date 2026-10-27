import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { languageFromSearch, localizedHref, normalizeText, translate } from '../public/i18n-core.js';
import { en } from '../public/translations-en.js';

test('language has an explicit German default and only accepts supported values', () => {
  assert.equal(languageFromSearch(''), 'de');
  assert.equal(languageFromSearch('?lang=en'), 'en');
  assert.equal(languageFromSearch('?lang=fr'), 'de');
  assert.equal(languageFromSearch('?source=beta&lang=en'), 'en');
});
test('translations retain whitespace and German originals without HTML execution', () => {
  assert.equal(translate('  Datenschutz\n', 'en'), '  Privacy\n');
  assert.equal(translate('  Datenschutz\n', 'de'), '  Datenschutz\n');
  assert.equal(normalizeText('  Dein\n Zugang '), 'Dein Zugang');
  assert.equal(translate('untouched sample data', 'en'), 'untouched sample data');
  assert.ok(Object.keys(en).length > 340);
  for (const [source, value] of Object.entries(en)) {
    assert.equal(normalizeText(source), source);
    assert.equal(typeof value, 'string');
    assert.ok(value.length > 0);
    assert.doesNotMatch(value, /<\/?(?:script|iframe|img|a|strong)\b/i);
  }
});
test('locale survives site navigation while images, emails and external links stay unchanged', () => {
  const base = 'https://www.novaireai.de/beta?lang=en';
  assert.equal(localizedHref('datenschutz.html#beta', base, 'en'), '/datenschutz.html?lang=en#beta');
  assert.equal(localizedHref('/beta?ref=school', base, 'en'), '/beta?ref=school&lang=en');
  assert.equal(localizedHref('/beta?ref=school&lang=en#bewerbung', base, 'de'), '/beta?ref=school#bewerbung');
  for (const href of ['#bewerbung', 'assets/app-live.png', '/assets/file.zip', 'mailto:support@novaireai.de', 'https://supabase.com/privacy']) {
    assert.equal(localizedHref(href, base, 'en'), href);
  }
});
test('every generated and handwritten page ships the accessible language control and local runtime', async () => {
  const root = new URL('../public/', import.meta.url);
  for (const filename of (await readdir(root)).filter((name) => name.endsWith('.html'))) {
    const source = await readFile(new URL(filename, root), 'utf8');
    assert.match(source, /<button[^>]+type="button"[^>]+data-language-toggle/, filename);
    assert.match(source, /data-language-label/, filename);
    assert.match(source, /src="\/?i18n\.js"[^>]*type="module"|type="module"[^>]*src="\/?i18n\.js"/, filename);
    assert.match(source, /href="\/?locale\.css"/, filename);
  }
});
test('switching language cannot replace the form or write any input value', async () => {
  const source = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /innerHTML|outerHTML|replaceChildren|\.value\s*=|\.checked\s*=|form\.reset|\bfetch\s*\(/);
  assert.match(source, /textarea,input/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /finally\s*\{/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /novaire:languagechange/);
});
test('privacy describes the public total and local translation without applicant data or translation services', async () => {
  const source = await readFile(new URL('../public/datenschutz.html', import.meta.url), 'utf8');
  assert.match(source, /höchstens einmal pro Minute/);
  assert.match(source, /keine Bewerbungsinhalte übermittelt oder zurückgegeben/);
  assert.match(source, /nicht an einen Übersetzungsdienst/);
});
