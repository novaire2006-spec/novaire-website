// Optional visual QA; Playwright is a development tool, never shipped.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true});
  const output = path.resolve(__dirname,'../qa');
  await fs.mkdir(output,{recursive:true});
  const errors = [];
  const external = [];
  for (const width of [320,390,768,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page = await context.newPage();
    page.on('pageerror',(error)=>errors.push(String(error)));
    page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
    page.on('request',(request)=>{if(!request.url().startsWith('http://127.0.0.1:4173/'))external.push(request.url());});
    await page.goto('http://127.0.0.1:4173/');
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,`overflow at ${width}`);
    for (const image of await page.locator('main img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((el)=>el.decode());
      assert.equal(await image.evaluate((el)=>el.naturalWidth>0),true);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(output,`home-${width}.png`),fullPage:true});
    await page.locator('.hero').screenshot({path:path.join(output,`hero-${width}.png`)});
    if (width===1440 || width===390) await page.locator('.product-section').screenshot({path:path.join(output,`products-${width}.png`)});
    await page.locator('.menu summary').click();
    assert.equal(await page.locator('.menu').getAttribute('open'),'');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.menu').getAttribute('open'),null);
    const preview = page.locator('[data-preview]').nth(1);
    await preview.click();
    assert.equal(await page.locator('dialog').evaluate((el)=>el.open),true);
    await page.keyboard.press('Escape');
    assert.equal(await preview.evaluate((el)=>el===document.activeElement),true);
    for (const slug of ['support','datenschutz','impressum','agb']) {
      const response = await page.goto(`http://127.0.0.1:4173/${slug}`);
      assert.equal(response.status(),200);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,`${slug} overflow at ${width}`);
    }
    assert.equal((await context.cookies()).length,0);
    await context.close();
  }
  const plain = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page = await plain.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('.menu summary').click();
  await page.locator('.menu a[href="support.html"]').click();
  assert.match(await page.title(),/helfen/);
  await plain.close();
  const animated = await browser.newContext({viewport:{width:1440,height:1000}});
  const animationPage = await animated.newPage();
  await animationPage.goto('http://127.0.0.1:4173/');
  await animationPage.waitForTimeout(1800);
  await animationPage.screenshot({path:path.join(output,'hero-light-pass.png')});
  await animationPage.waitForTimeout(2800);
  assert.equal(await animationPage.locator('.brand-light').evaluate((el)=>getComputedStyle(el).opacity),'0');
  await animated.close();
  await browser.close();
  assert.deepEqual(external,[],'unexpected external runtime request');
  assert.deepEqual(errors,[],'browser errors');
  console.log('PASS: four viewports, all text pages, real assets, keyboard/menu/dialog, no-JS fallback, reduced motion, intro end state, zero cookies/external requests/console errors.');
})().catch((error)=>{console.error(error);process.exit(1);});
