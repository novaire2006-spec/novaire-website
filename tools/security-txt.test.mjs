import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Security report (27.11.2026): a place to report vulnerabilities, RFC 9116.
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

test('security.txt names the contact, languages, canonical address and a valid expiry', async () => {
  const txt = await read('public/.well-known/security.txt');
  assert.match(txt, /^Contact: mailto:support@novaireai\.de$/m);
  assert.match(txt, /^Preferred-Languages: de, en$/m);
  assert.match(txt, /^Canonical: https:\/\/www\.novaireai\.de\/\.well-known\/security\.txt$/m);
  assert.match(txt, /^Policy: https:\/\/www\.novaireai\.de\/support$/m);
  const expires = Date.parse(txt.match(/^Expires: (\S+)$/m)?.[1] ?? '');
  assert.ok(expires > Date.parse('2026-11-27T00:00:00Z'), 'expires in the future');
  // RFC 9116 recommends less than a year ahead.
  assert.ok(expires < Date.parse('2027-11-27T00:00:00Z'), 'less than a year ahead');
  assert.doesNotMatch(txt, /<|script/i);
});

test('security.txt is plain text and also reachable without www', async () => {
  const vercel = JSON.parse(await read('vercel.json'));
  const rule = vercel.headers.find((h) => h.source === '/.well-known/security.txt');
  assert.ok(rule, 'own header rule');
  assert.equal(rule.headers.find((h) => h.key === 'Content-Type')?.value, 'text/plain; charset=utf-8');
  const redirect = vercel.redirects.find((r) => r.has?.some((h) => h.value === 'novaireai.de'));
  assert.match(redirect.source, /security\\\\?\.txt/);
});
