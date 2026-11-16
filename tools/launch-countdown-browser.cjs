const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const origin = process.env.NOVA_WEBSITE_PREVIEW || 'http://127.0.0.1:4187';
  const output = path.resolve(__dirname, '../qa/launch-countdown');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'America/Los_Angeles' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-11-16T17:00:00Z'));
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.locator('[data-launch-unit="days"]').getByText('11', { exact: true }).waitFor();
      assert.equal(await page.locator('[data-launch-unit="hours"]').textContent(), '00');
      const geometry = await page.evaluate(() => {
        const banner = document.querySelector('[data-launch-countdown]').getBoundingClientRect();
        const header = document.querySelector('.site-header').getBoundingClientRect();
        const clock = document.querySelector('[role="timer"]').getBoundingClientRect();
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, top: banner.top, bottom: banner.bottom, headerTop: header.top, clockLeft: clock.left, clockRight: clock.right };
      });
      assert.equal(geometry.top, 0);
      assert.ok(geometry.scrollWidth <= width + 1, JSON.stringify(geometry));
      assert.ok(geometry.headerTop >= geometry.bottom - 1, JSON.stringify(geometry));
      assert.ok(geometry.clockLeft >= 0 && geometry.clockRight <= width, JSON.stringify(geometry));
      if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `countdown-${width}.png`) });
      await page.locator('[data-language-toggle]').click();
      await page.getByText('Your learning universe is launching.', { exact: true }).waitFor();
      assert.ok((await page.locator('.launch-countdown-date').textContent()).includes('6:00 pm CET'));
      assert.equal(await page.locator('.launch-countdown-label').first().textContent(), 'Days');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.locator('[data-language-toggle]').click();
      await page.getByText('Dein Lernuniversum startet.', { exact: true }).waitFor();
      await page.locator('.menu summary').click();
      await page.locator('.menu nav a').first().waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.menu').evaluate(el => el.open), false);
      await page.evaluate(() => scrollTo(0, 800));
      await page.waitForTimeout(450);
      assert.equal(Math.round(await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().top)), 0);
      await page.clock.setFixedTime(new Date('2026-11-27T16:59:59Z'));
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('[data-launch-unit="seconds"]').textContent === '01');
      assert.equal(await page.locator('[role="timer"]').isVisible(), true);
      await page.clock.setFixedTime(new Date('2026-11-27T17:00:00Z'));
      await page.locator('[data-launch-arrived]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[role="timer"]').isVisible(), false);
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS ${width}px: layout, Berlin time, DE/EN, menu, sticky header, expiry, no JS errors`);
      await context.close();
    }
    for (const options of [{ reducedMotion: 'reduce' }, { javaScriptEnabled: false }]) {
      const context = await browser.newContext({ ...options, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(origin, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.launch-countdown-date time').textContent(), '27. November · 18:00 Uhr MEZ');
      if (options.reducedMotion) {
        assert.equal(await page.locator('[data-launch-countdown]').evaluate(el => getComputedStyle(el, '::after').animationName), 'none');
        assert.equal(await page.locator('.launch-countdown-value').first().evaluate(el => el.getAnimations().length), 0);
      }
      console.log(`PASS ${JSON.stringify(options)}: readable date, motion fallback`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
