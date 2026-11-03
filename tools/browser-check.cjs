// Optional QA: supply puppeteer-core and Chromium through environment variables.
// No production dependency. All remote application calls are mocked, never submitted.
const { launch } = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = process.env.NOVA_WEBSITE_PREVIEW || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.QA_OUTPUT || path.join(__dirname, '../qa'));
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await launch({ headless: true, executablePath: process.env.BROWSER_PATH });
  const errors = [], checks = [];
  try {
    const makePage = async (width, reduced = true) => {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().startsWith(origin + '/') || request.url().startsWith('data:')) return request.continue();
        if (request.url().endsWith('/beta-application/count') && request.method() === 'GET') return request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ count: 1234, updatedAt: new Date().toISOString() }) });
        errors.push(`Blocked unexpected external ${request.method()} request`);
        return request.abort();
      });
      page.on('pageerror', error => errors.push(error.message));
      return page;
    };
    for (const width of [320, 390, 768, 1440]) {
      const page = await makePage(width);
      for (const language of ['de', 'en']) for (const slug of ['', 'beta', 'datenschutz', 'support', 'agb', 'impressum', '404']) {
        const response = await page.goto(`${origin}/${slug}${language === 'en' ? '?lang=en' : ''}`, { waitUntil: 'networkidle0' });
        assert.equal(response.status(), 200, slug);
        assert.equal(await page.$eval('html', el => el.lang), language);
        assert.equal(await page.$$eval('h1', els => els.length), 1, `${slug}: one h1`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${slug}/${language}: overflow at ${width}`);
        assert.equal(await page.$$eval('[data-seasonal-stars],[data-halloween-caption],.seasonal-scene', els => els.length), 0);
        if (!slug) {
          assert.equal(await page.$eval('[data-brand-symbol]', el => getComputedStyle(el).animationName), 'none');
          assert.equal(await page.$eval('[data-brand-motion-toggle]', el => el.hidden), true);
          assert.equal(await page.$$eval('video', els => els.length), 4);
          assert.equal(await page.$$eval('video', els => els.every(el => el.controls && !el.autoplay && el.preload === 'none')), true);
          assert.equal(await page.$eval('[data-count-value]', el => el.textContent), language === 'de' ? '1.234' : '1,234');
          await page.$$eval('main img', async els => { for (const el of els) { el.loading = 'eager'; await el.decode(); } });
        }
        if (slug === 'beta') {
          assert.equal(await page.$eval('body', el => el.dataset.betaState), 'closed');
          assert.equal(await page.$eval('#hero-apply-link', el => getComputedStyle(el).display), 'none');
          assert.equal(await page.$eval('form button[type="submit"]', el => el.matches(':disabled')), true);
        }
        if (slug === 'datenschutz') {
          const box = await page.$eval('.privacy-delete-box', el => {
            const css = getComputedStyle(el);
            return { border: css.borderTopColor, background: css.backgroundColor, shadow: css.boxShadow, text: el.textContent };
          });
          assert.equal(box.border, 'rgb(75, 141, 250)');
          assert.equal(box.background, 'rgba(0, 0, 0, 0)');
          assert.equal(box.shadow, 'none');
          assert.match(box.text, language === 'de' ? /Konto & Sicherheit/ : /Account & Security/);
          if (language === 'de' && [390, 1440].includes(width)) await (await page.$('.privacy-delete-box')).screenshot({ path: path.join(output, `deletion-${width}.png`) });
        }
        if (language === 'de' && [390, 1440].includes(width) && ['', 'beta'].includes(slug)) {
          await page.evaluate(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')));
          await page.screenshot({ path: path.join(output, `${slug || 'home'}-${width}.png`), fullPage: true });
          if (!slug) await (await page.$('.hero')).screenshot({ path: path.join(output, `hero-${width}.png`) });
          if (!slug) await (await page.$('.launch-section')).screenshot({ path: path.join(output, `updates-${width}.png`) });
        }
      }
      await page.goto(origin, { waitUntil: 'networkidle0' });
      await page.click('.menu summary');
      assert.equal(await page.$eval('.menu', el => el.open), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.$eval('.menu', el => el.open), false);
      assert.equal(await page.$eval('.menu summary', el => el === document.activeElement), true);
      await page.click('[data-preview]');
      assert.equal(await page.$eval('dialog', el => el.open), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.$eval('[data-preview]', el => el === document.activeElement), true);
      await page.click('[data-language-toggle]');
      await page.waitForFunction(() => document.documentElement.lang === 'en');
      assert.equal(await page.$eval('html', el => el.classList.contains('language-changing')), false);
      assert.ok((await page.$eval('.menu a[href*="datenschutz"]', el => el.href)).includes('lang=en'));
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.equal((await page.cookies()).length, 0);
      checks.push(`7 pages in DE/EN at ${width}px; images, videos, counter, closed beta, deletion box, keyboard`);
      await page.close();
    }
    const animated = await makePage(1440, false);
    await animated.goto(origin, { waitUntil: 'networkidle0' });
    await animated.waitForFunction(() => document.querySelector('[data-brand-symbol]').dataset.motionState === 'running');
    assert.equal(await animated.$eval('[data-brand-symbol]', el => getComputedStyle(el).animationDuration), '180s');
    assert.equal(await animated.$eval('.brand-wordmark-crop', el => getComputedStyle(el).transform), 'none');
    await animated.click('[data-brand-motion-toggle]');
    assert.equal(await animated.$eval('[data-brand-symbol]', el => getComputedStyle(el).animationPlayState), 'paused');
    assert.equal(await animated.$eval('[data-brand-motion-toggle]', el => el.getAttribute('aria-pressed')), 'true');
    await animated.click('[data-brand-motion-toggle]');
    await animated.evaluate(() => document.querySelector('#updates').scrollIntoView({ behavior: 'instant' }));
    await animated.waitForFunction(() => document.querySelector('[data-brand-symbol]').dataset.motionState === 'paused');
    await animated.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await animated.waitForFunction(() => document.querySelector('[data-brand-symbol]').dataset.motionState === 'running');
    await animated.$eval('[data-brand-symbol]', el => { el.getAnimations()[0].currentTime = 22500; });
    await (await animated.$('.brand-signature')).screenshot({ path: path.join(output, 'rotating-logo-45deg.png') });
    checks.push('180-second rotation, fixed wordmark, manual pause and offscreen suspension');
    await animated.$eval('[data-language-toggle]', el => el.click());
    assert.equal(await animated.$eval('html', el => el.classList.contains('language-changing')), true);
    await animated.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.classList.contains('language-changing'));
    await animated.close();
    checks.push('language animation and reduced-motion alternative');
    const plain = await makePage(390);
    await plain.setJavaScriptEnabled(false);
    await plain.goto(origin + '/beta');
    assert.equal(await plain.$eval('#hero-apply-link', el => getComputedStyle(el).display), 'none');
    assert.equal(await plain.$eval('form button[type="submit"]', el => el.matches(':disabled')), true);
    await plain.close();
    checks.push('beta remains closed without JavaScript');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ checks, errors, screenshotDirectory: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
