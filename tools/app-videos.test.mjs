import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { en } from '../public/translations-en.js';

const root = new URL('../public/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const section = html.match(/<section[^>]+id="app-in-aktion"[\s\S]*?<\/section>/)?.[0];
const clips = [...section.matchAll(/<video\b([^>]+)>([\s\S]*?)<\/video>/g)];

test('four local demos have native, user-initiated playback and accessible descriptions', async () => {
  assert.equal(clips.length, 4);
  for (const [, attributes, children] of clips) {
    assert.match(attributes, /\bcontrols\b/);
    assert.match(attributes, /\bplaysinline\b/);
    assert.match(attributes, /preload="none"/);
    assert.doesNotMatch(attributes, /\bautoplay\b|\bloop\b|data-preview/);
    for (const name of ['aria-labelledby', 'aria-describedby']) {
      const id = attributes.match(new RegExp(`${name}="([^"]+)"`))?.[1];
      assert.ok(id && html.includes(`id="${id}"`), name);
    }
    const poster = attributes.match(/poster="([^"]+)"/)?.[1];
    const media = children.match(/<source src="([^"]+)" type="video\/mp4"/)?.[1];
    for (const asset of [poster, media]) {
      assert.match(asset, /^assets\/demos\/[a-z-]+\.(?:jpg|mp4)$/);
      assert.ok((await stat(new URL(asset, root))).size > 0);
    }
    assert.ok(html.includes(`class="demo-direct-link" href="${media}"`));
  }
  assert.match(section, /ohne Ton/);
  assert.match(section, /App-Ansichten sind auf Deutsch/);
});

test('MP4 demos are compact, H.264, silent, and streamable before the full download', async () => {
  let total = 0;
  for (const [, , children] of clips) {
    const asset = children.match(/<source src="([^"]+)"/)[1];
    const bytes = await readFile(new URL(asset, root));
    total += bytes.length;
    const boxes = [];
    for (let offset = 0; offset < bytes.length;) {
      const size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      assert.ok(size >= 8 && offset + size <= bytes.length, asset);
      boxes.push(type);
      offset += size;
    }
    assert.ok(boxes.indexOf('moov') > -1 && boxes.indexOf('moov') < boxes.indexOf('mdat'), asset);
    const moovOffset = bytes.indexOf(Buffer.from('moov'));
    const moovSize = bytes.readUInt32BE(moovOffset - 4);
    const metadata = bytes.subarray(moovOffset, moovOffset - 4 + moovSize).toString('latin1');
    assert.match(metadata, /avc1/);
    assert.doesNotMatch(metadata, /soun|com\.apple\.quicktime\.location|creation_time/);
  }
  assert.ok(total < 5 * 1024 * 1024, `Combined video bytes: ${total}`);
});

test('new visitor-facing demo copy is available in English', () => {
  for (const match of section.matchAll(/>([^<>]+)</g)) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (!text || /^\d|^↗$|^NOVA (?:CHAT|LIVE)$/.test(text)) continue;
    assert.ok(en[text], `Missing translation: ${text}`);
  }
});

test('playing one clip pauses the others; hiding the page pauses all without autoplay', async () => {
  const listeners = {};
  const videos = Array.from({ length: 4 }, () => ({
    paused: true,
    listeners: {},
    pause() { this.paused = true; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
  }));
  const document = {
    body: { classList: { contains: () => false } }, hidden: false,
    addEventListener(type, callback) { listeners[type] = callback; },
    querySelector: () => null,
    querySelectorAll: (selector) => selector === '.app-demo' ? videos : [],
  };
  const source = await readFile(new URL('app.js', root), 'utf8');
  vm.runInNewContext(source, { document, window: {}, matchMedia: () => ({ matches: true }) });
  assert.ok(videos.every((video) => video.paused));
  videos[0].paused = false;
  videos[2].paused = false;
  videos[2].listeners.play();
  assert.deepEqual(videos.map((video) => video.paused), [true, true, false, true]);
  listeners.visibilitychange();
  assert.equal(videos[2].paused, false);
  document.hidden = true;
  listeners.visibilitychange();
  assert.ok(videos.every((video) => video.paused));
  document.hidden = false;
  listeners.visibilitychange();
  assert.ok(videos.every((video) => video.paused));
});
