// Optional visual QA; Playwright is a development tool, never shipped.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true});
  const output = path.resolve(__dirname,'../qa');
  const origin = process.env.NOVA_WEBSITE_PREVIEW || 'http://127.0.0.1:4173';
  const endpoint = 'https://naafzrrhjsfaqqrnhrcn.supabase.co/functions/v1/beta-application';
  await fs.mkdir(output,{recursive:true});
  const errors = [];
  const external = [];
  const checks = [];
  const track = (page) => {
    page.on('pageerror',(error)=>errors.push(String(error)));
    page.on('console',(message)=>{
      // An HTTP failure is deliberate in the API resilience checks below.
      if(message.type()==='error' && !/^Failed to load resource: the server responded with a status of (?:429|503|410)\b/.test(message.text())) errors.push(message.text());
    });
    page.on('request',(request)=>{if(!request.url().startsWith(`${origin}/`) && request.url() !== endpoint) external.push(request.url());});
  };
  const checkWidth = async (page, width, name) => {
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,`${name} overflow at ${width}`);
    assert.equal(await page.locator('h1').count(),1,`${name}: one h1`);
  };
  const captureSection = async (page, selector, filename) => {
    // Capture document coordinates from the top, not a viewport extended by an
    // oversized element capture: that can expose offscreen fixed skip links.
    await page.evaluate(() => window.scrollTo(0,0));
    const clip = await page.locator(selector).boundingBox();
    assert.ok(clip, `missing visual section ${selector}`);
    await page.screenshot({path:path.join(output,filename),clip,fullPage:true});
  };
  const checkDecoration = async (page, name) => {
    const decoration = page.locator('img[data-seasonal-decoration], img.seasonal-pumpkin');
    for (const image of await decoration.all()) {
      assert.equal(await image.getAttribute('alt'),'','decorative artwork must have empty alt');
      assert.equal(await image.evaluate((el)=>el.closest('[aria-hidden="true"]') !== null),true,`${name}: decoration must be hidden from assistive technology`);
      assert.equal(await image.evaluate((el)=>getComputedStyle(el).pointerEvents),'none',`${name}: decoration must not intercept touches`);
      assert.equal(await image.evaluate((el)=>el.tabIndex),-1,`${name}: decoration must not enter keyboard navigation`);
      assert.equal(await image.evaluate((el)=>el.closest('a,button,summary') !== null),false,`${name}: decoration must not pretend to be a control`);
      assert.match(await image.getAttribute('src'), /\.webp$/, `${name}: flat placeholders have been replaced with optimized local artwork`);
      // Some secondary accents are intentionally removed at narrow widths or
      // high contrast. A hidden lazy image must not be forced into the layout.
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((el)=>el.decode());
      assert.equal(await image.evaluate((el)=>el.naturalWidth>0),true,`${name}: decorative artwork decodes`);
      const transparentEdges = await image.evaluate((el) => {
        const canvas = document.createElement('canvas');
        canvas.width=el.naturalWidth; canvas.height=el.naturalHeight;
        const context=canvas.getContext('2d'); context.drawImage(el,0,0);
        return [[0,0],[canvas.width-1,0],[0,canvas.height-1],[canvas.width-1,canvas.height-1]]
          .some(([x,y])=>context.getImageData(x,y,1,1).data[3] < 16);
      });
      assert.equal(transparentEdges,true,`${name}: realistic cutouts have transparency, not opaque rectangular backgrounds`);
    }
  };
  const checkSeasonalBackdrop = async (page, name) => {
    const backdrop = page.locator('[data-seasonal-stars]');
    assert.equal(await backdrop.count(),1,`${name}: one shared star backdrop`);
    assert.equal(await backdrop.getAttribute('aria-hidden'),'true',`${name}: stars remain purely decorative`);
    assert.equal(await backdrop.evaluate((el)=>getComputedStyle(el).pointerEvents),'none',`${name}: backdrop cannot intercept gestures`);
    assert.equal(await backdrop.evaluate((el)=>el.tabIndex),-1,`${name}: backdrop is not focusable`);
    assert.equal(await backdrop.evaluate((el)=>el.getAnimations({subtree:true}).length),0,`${name}: reduced motion stops any star motion`);
    const stars=backdrop.locator('.seasonal-star');
    assert.equal(await stars.count(),72,`${name}: star density is bounded`);
    for (const color of ['white','yellow','blue']) assert.ok(await backdrop.locator(`.seasonal-star-${color}`).count(),`${name}: ${color} stars are present`);
    const captions = page.locator('[data-halloween-caption]');
    assert.ok(await captions.count(),`${name}: the seasonal deadline caption exists`);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.fonts.check('24px "Novaire Halloween"')),true,`${name}: the local display font is decoded and ready`);
    for (const caption of await captions.all()) {
      assert.match(await caption.innerText(),/Endet vor Halloween[^]*damit ihr feiern könnt/);
      assert.match(await caption.evaluate((el)=>getComputedStyle(el).fontFamily),/Creepster|Novaire Halloween/i,`${name}: Halloween font is scoped to the caption`);
    }
    assert.doesNotMatch(await page.locator('body').evaluate((el)=>getComputedStyle(el).fontFamily),/Creepster|Novaire Halloween/i,`${name}: the normal body font remains native`);
    if (await page.locator('#beta-motivation').count()) {
      assert.doesNotMatch(await page.locator('#beta-motivation').evaluate((el)=>getComputedStyle(el).fontFamily),/Creepster|Novaire Halloween/i,`${name}: form inputs remain legible native text`);
    }
  };
  const checkUnobscuredControls = async (page, name) => {
    const controls = page.locator('header .menu summary, header .header-link, #hero-apply-link, form input:not([type="hidden"]):not([name="website"]), form textarea, form select, form button');
    for (const control of await controls.all()) {
      if (!(await control.isVisible()) || await control.isDisabled()) continue;
      await control.scrollIntoViewIfNeeded();
      const clear = await control.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width/2,box.top + box.height/2);
        return el === hit || el.contains(hit);
      });
      assert.equal(clear,true,`${name}: ${await control.getAttribute('id') || await control.getAttribute('class') || await control.getAttribute('name')} is obstructed`);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
  };
  for (const width of [320,390,768,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page = await context.newPage();
    track(page);
    await page.goto(`${origin}/`);
    await page.waitForLoadState('networkidle');
    await checkWidth(page, width, 'home');
    await checkDecoration(page, `home ${width}px`);
    await checkSeasonalBackdrop(page, `home ${width}px`);
    await checkUnobscuredControls(page, `home ${width}px`);
    for (const image of await page.locator('main img').all()) {
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((el)=>el.decode());
      assert.equal(await image.evaluate((el)=>el.naturalWidth>0),true);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(output,`home-${width}.png`),fullPage:true});
    await page.locator('.hero').screenshot({path:path.join(output,`hero-${width}.png`)});
    if (width===1440 || width===390) {
      await page.locator('.product-section').screenshot({path:path.join(output,`products-${width}.png`)});
      await captureSection(page,'.intro',`home-intro-${width}.png`);
      await captureSection(page,'.beta-invitation',`home-beta-invitation-${width}.png`);
      await captureSection(page,'.closing',`home-closing-${width}.png`);
    }
    await page.locator('.menu summary').click();
    assert.equal(await page.locator('.menu').getAttribute('open'),'');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.menu').getAttribute('open'),null);
    assert.equal(await page.locator('.menu summary').evaluate((el)=>el===document.activeElement),true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.menu').getAttribute('open'),'');
    await page.locator('.menu a[href="beta.html"]').click();
    await page.waitForURL(/\/beta(?:\.html)?$/);
    await checkWidth(page, width, 'beta menu target');
    await page.goto(`${origin}/`);
    const preview = page.locator('[data-preview]').nth(1);
    await preview.click();
    assert.equal(await page.locator('dialog').evaluate((el)=>el.open),true);
    await page.keyboard.press('Escape');
    assert.equal(await preview.evaluate((el)=>el===document.activeElement),true);
    for (const slug of ['support','datenschutz','impressum','agb','beta','404']) {
      const response = await page.goto(`${origin}/${slug}`);
      assert.equal(response.status(),200);
      await checkWidth(page, width, slug);
      if (slug === 'beta') {
        await page.waitForLoadState('networkidle');
        assert.ok(await page.locator('form').count());
        await checkDecoration(page, `beta ${width}px`);
        await checkSeasonalBackdrop(page, `beta ${width}px`);
        await checkUnobscuredControls(page, `beta ${width}px`);
        const fields = await page.locator('input:not([type="hidden"]):not([name="website"]), textarea, select').all();
        for (const field of fields) {
          assert.ok(await field.evaluate((el) => el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')), `unlabelled beta field at ${width}`);
        }
        // Keyboard focus is verified above; neutral design captures should not
        // include the deliberately visible focus-only skip link.
        await page.evaluate(() => document.activeElement?.blur());
        await page.screenshot({path:path.join(output,`beta-${width}.png`),fullPage:true});
        if (width === 390 || width === 1440) {
          await captureSection(page, '.beta-hero', `beta-hero-${width}.png`);
          await captureSection(page, '#bewerbung', `beta-form-${width}.png`);
        }
      } else {
        assert.equal(await page.locator('body.seasonal-site, [data-seasonal-stars], [data-halloween-caption]').count(),0,`${slug}: no marketing ornaments on legal/support/404 pages`);
      }
    }
    assert.equal((await context.cookies()).length,0);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length),0);
    checks.push(`all seven pages at ${width}px`);
    await context.close();
  }
  const plain = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page = await plain.newPage();
  track(page);
  await page.goto(`${origin}/`);
  await page.locator('.menu summary').click();
  await page.locator('.menu a[href="support.html"]').click();
  assert.match(await page.title(),/helfen/);
  await page.goto(`${origin}/beta`);
  assert.match(await page.locator('main').innerText(), /30\.\s*Oktober\s*2026/);
  assert.ok(await page.locator('noscript a[href^="mailto:"]').count());
  assert.equal(await page.locator('form button[type="submit"]').isDisabled(),true,'no-JavaScript form is disabled rather than pretending to submit');
  checks.push('no-JavaScript menu, deadline and email fallback');
  await plain.close();
  const animated = await browser.newContext({viewport:{width:1440,height:1000}});
  const animationPage = await animated.newPage();
  track(animationPage);
  await animationPage.goto(`${origin}/`);
  await animationPage.waitForTimeout(1800);
  await animationPage.screenshot({path:path.join(output,'hero-light-pass.png')});
  await animationPage.waitForTimeout(2800);
  assert.equal(await animationPage.locator('.brand-light').evaluate((el)=>getComputedStyle(el).opacity),'0');
  await animated.close();
  checks.push('original image dialog, keyboard navigation and intro end state');
  checks.push('local realistic artwork decodes, scoped decorative stars and licensed caption face at all four widths');

  const highContrast = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const contrastPage = await highContrast.newPage();
  track(contrastPage);
  await contrastPage.emulateMedia({contrast:'more',reducedMotion:'reduce'});
  for (const slug of ['', 'beta']) {
    await contrastPage.goto(`${origin}/${slug}`);
    await contrastPage.waitForLoadState('networkidle');
    assert.equal(await contrastPage.locator('[data-seasonal-stars]').isVisible(),false,'increased contrast hides background specks');
    await checkUnobscuredControls(contrastPage, `high contrast ${slug || 'home'}`);
  }
  await highContrast.close();
  checks.push('increased contrast hides decorative stars and preserves usable controls');

  const fillApplication = async (page, {age = 18, email = 'qa-adult@example.invalid'} = {}) => {
    await page.locator('[name="name"]').fill('Test Bewerbung');
    await page.locator('[name="age"]').fill(String(age));
    await page.locator(`[name="applicantKind"][value="${age < 16 ? 'guardian' : 'self'}"]`).check();
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="source"]').selectOption('friends');
    await page.locator('[name="motivation"]').fill('Ich möchte die Lernfunktionen in Ruhe ausprobieren und verständliches Feedback dazu geben.');
    await page.locator('[name="device"]').fill('iPhone 15');
    await page.locator('[name="consent"]').check();
  };
  const submit = (page) => page.locator('form button[type="submit"]');
  const functionalContext = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const formPage = await functionalContext.newPage();
  track(formPage);
  const submissions = [];
  let status = 202;
  let releasePending;
  let hold = false;
  let acceptance = true;
  await formPage.route(endpoint, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({status:204, headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'}});
      return;
    }
    submissions.push(route.request().postDataJSON());
    assert.equal(route.request().headers().authorization,undefined,'public form never embeds an authorization secret');
    assert.equal(route.request().headers().cookie,undefined,'public form never forwards cookies');
    if (hold) await new Promise((resolve) => {releasePending = resolve;});
    await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':origin,'retry-after':'1'},body:JSON.stringify(status===202 ? {accepted:acceptance} : {error: status===410 ? 'applications_closed' : status===429 ? 'rate_limited' : 'temporarily_unavailable',retryAfter:1})});
  });
  await formPage.goto(`${origin}/beta`);
  await submit(formPage).click();
  assert.equal(submissions.length,0,'empty validated form must not submit');
  await fillApplication(formPage);
  await formPage.locator('[name="email"]').fill('invalid-email');
  await submit(formPage).click();
  assert.equal(submissions.length,0,'invalid email must not submit');
  await formPage.locator('[name="email"]').fill('qa-adult@example.invalid');
  await formPage.locator('[name="motivation"]').fill('Zu kurz');
  await submit(formPage).click();
  assert.equal(submissions.length,0,'short motivation must not submit');
  await fillApplication(formPage);
  assert.match(await formPage.locator('#beta-motivation').getAttribute('placeholder'), /wir[^.!?]*jung/i, 'motivation prompt stays approachable');
  hold = true;
  await submit(formPage).click();
  await formPage.waitForFunction(() => document.querySelector('form button[type="submit"]').matches(':disabled'));
  await formPage.waitForTimeout(100);
  assert.equal(submissions.length,1,'exactly one request while inflight');
  await formPage.locator('form').evaluate((form) => form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await formPage.waitForTimeout(100);
  assert.equal(submissions.length,1,'programmatic duplicate submit is ignored');
  releasePending();
  await formPage.waitForFunction(() => /(?:angekommen|eingegangen|erhalten|Vielen Dank)/i.test(document.querySelector('main').innerText));
  assert.equal(submissions[0].applicantKind,'self');
  assert.equal(submissions[0].privacyVersion,'2026-10-beta-v1');
  assert.equal(submissions[0].consent,true);
  assert.match(submissions[0].requestId,/^[0-9a-f-]{36}$/i);
  assert.equal(await formPage.locator('#beta-success').isVisible(),true,'confirmed submission reveals receipt');
  const receipt = await formPage.locator('#beta-success').innerText();
  assert.match(receipt,/keine Zusage/i);
  assert.doesNotMatch(receipt,/herzlichen gl[üu]ckwunsch|du bist (?:angenommen|dabei)|dein (?:Beta)?platz ist sicher/i,'a form receipt is never a selection decision');
  for (const receiptWidth of [390,1440]) {
    await formPage.setViewportSize({width:receiptWidth,height:844});
    await checkWidth(formPage,receiptWidth,'beta receipt');
    await captureSection(formPage,'.beta-success',`beta-receipt-${receiptWidth}.png`);
  }
  await formPage.setViewportSize({width:390,height:844});
  checks.push('input constraints and accessible validation, real DOM form payload, inflight duplicate guard and mocked 202 success');
  checks.push('approachable motivation wording and honest mint receipt, never a fake admission notice');
  hold = false;

  acceptance = false;
  await formPage.goto(`${origin}/beta`);
  await fillApplication(formPage);
  await submit(formPage).click();
  await formPage.waitForFunction(() => !document.querySelector('form button[type="submit"]').matches(':disabled'));
  assert.equal(await formPage.locator('#beta-success').isVisible(),false,'unconfirmed 202 is not a success');
  assert.equal(await formPage.locator('[name="email"]').inputValue(),'qa-adult@example.invalid');
  acceptance = true;
  checks.push('unconfirmed 202 is never presented as accepted');

  for (const failedStatus of [503,429]) {
    status = failedStatus;
    await formPage.goto(`${origin}/beta`);
    await fillApplication(formPage);
    if (failedStatus === 503) await formPage.locator('[name="motivation"]').fill('Ich gebe hilfreiches Feedback. <img src="x" onerror="globalThis.betaInjected=true">');
    const priorCount = submissions.length;
    await submit(formPage).click();
    await formPage.waitForFunction(() => !document.querySelector('form button[type="submit"]').matches(':disabled'));
    assert.equal(submissions.length,priorCount+1);
    const failed = submissions.at(-1);
    assert.equal(await formPage.locator('[name="name"]').inputValue(),'Test Bewerbung');
    assert.equal(await formPage.locator('[name="email"]').inputValue(),'qa-adult@example.invalid');
    assert.match(await formPage.locator('[name="motivation"]').inputValue(),/Feedback/);
    assert.equal(await formPage.evaluate(() => globalThis.betaInjected === true),false,'typed markup must not execute');
    assert.equal(await formPage.locator('main img[src="x"]').count(),0,'typed markup must not become DOM');
    status = 202;
    await submit(formPage).click();
    await formPage.waitForFunction(() => /(?:angekommen|eingegangen|erhalten|Vielen Dank)/i.test(document.querySelector('main').innerText));
    assert.equal(submissions.at(-1).requestId,failed.requestId,'retry must keep requestId for idempotency');
    checks.push(`mocked ${failedStatus} recovery preserves form data and idempotency`);
  }

  await formPage.goto(`${origin}/beta`);
  await fillApplication(formPage,{age:14,email:'qa-parent@example.invalid'});
  assert.match(await formPage.locator('[name="email"]').evaluate((el)=>Array.from(el.labels).map((label)=>label.innerText).join(' ')), /Eltern|Sorgeberechtigt/i);
  assert.equal(await formPage.locator('[name="applicantKind"][value="self"]').isDisabled(),true);
  await formPage.locator('[name="consent"]').check();
  await submit(formPage).click();
  await formPage.waitForFunction(() => /(?:angekommen|eingegangen|erhalten|Vielen Dank)/i.test(document.querySelector('main').innerText));
  assert.equal(submissions.at(-1).applicantKind,'guardian');
  assert.equal(submissions.at(-1).age,14);
  assert.equal(submissions.at(-1).email,'qa-parent@example.invalid');
  checks.push('under-16 guardian application and parent email label');

  await formPage.goto(`${origin}/beta`);
  await fillApplication(formPage);
  await formPage.locator('[name="age"]').fill('14');
  assert.equal(await formPage.locator('[name="applicantKind"][value="self"]').isChecked(),false);
  assert.equal(await formPage.locator('[name="applicantKind"][value="guardian"]').isChecked(),false,'parent status must not be silently auto-selected');
  const beforeGuardian = submissions.length;
  await submit(formPage).click();
  assert.equal(submissions.length,beforeGuardian,'under-16 age change requires explicit guardian choice');
  assert.equal(await formPage.locator('#applicantKind-error').isVisible(),true);
  checks.push('age change clears self choice and requires explicit parent application');

  status = 410;
  await formPage.goto(`${origin}/beta`);
  await fillApplication(formPage);
  await submit(formPage).click();
  await formPage.waitForFunction(() => /(?:geschlossen|beendet|vorbei|abgelaufen)/i.test(document.querySelector('main').innerText));
  assert.equal(await submit(formPage).isDisabled(),true);
  checks.push('backend deadline rejection locks form');
  assert.equal((await functionalContext.cookies()).length,0);
  assert.equal(await formPage.evaluate(() => localStorage.length + sessionStorage.length),0);
  await functionalContext.close();

  const expired = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const closedPage = await expired.newPage();
  track(closedPage);
  await closedPage.clock.install({time:new Date('2026-10-30T23:00:01Z')});
  await closedPage.goto(`${origin}/beta`);
  await closedPage.waitForFunction(() => /(?:geschlossen|beendet|vorbei|abgelaufen)/i.test(document.querySelector('main').innerText));
  assert.equal(await submit(closedPage).isDisabled(),true);
  checks.push('client clock closes at Berlin 30 October 2026 23:59 cutoff');
  await expired.close();
  await browser.close();
  assert.deepEqual(external,[],'unexpected external runtime request');
  assert.deepEqual(errors,[],'browser errors');
  await fs.writeFile(path.join(output,'browser-report.json'),JSON.stringify({backend:'mocked exact beta endpoint; no real applications written',checks,errors,unexpectedExternalRequests:external},null,2));
  console.log(`PASS: ${checks.length} browser check groups. Seven pages/four widths, existing menu/dialog/intro, beta validation/guardian/success/retry/expiry, no-JS, zero cookies/storage/unexpected external requests/console errors. API responses deliberately mocked; no real applications written.`);
})().catch((error)=>{console.error(error);process.exit(1);});
