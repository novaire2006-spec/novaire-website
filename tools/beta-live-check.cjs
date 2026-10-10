// Explicit, authorized end-to-end QA only. Creates one synthetic .invalid
// application on the live backend; returned requestId must be removed by owner.
if (!process.argv.includes('--run')) throw new Error('Explicit --run required');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const endpoint = 'https://naafzrrhjsfaqqrnhrcn.supabase.co/functions/v1/beta-application';
(async () => {
  const browser = await chromium.launch({headless:true});
  let fixtureId;
  try {
    const page = await browser.newPage({ viewport:{width:390,height:844} });
    page.on('request', request => {
      if (request.url() === endpoint && request.method() === 'POST') {
        fixtureId = request.postDataJSON().requestId;
      }
    });
    await page.goto('http://127.0.0.1:4173/beta.html');
    await page.locator('#beta-name').fill('Novaire Browser QA');
    await page.locator('#beta-age').fill('18');
    await page.locator('[name="applicantKind"][value="self"]').check();
    await page.locator('#beta-email').fill(`novaire-browser-qa-${randomUUID()}@example.invalid`);
    await page.locator('#beta-source').selectOption('other');
    await page.locator('#beta-source-detail').fill('Authorized browser QA');
    await page.locator('#beta-motivation').fill('Synthetic end-to-end browser fixture, not a real applicant.');
    await page.locator('#beta-consent').check();
    const received = page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST');
    await page.locator('#beta-submit').click();
    const response = await received;
    assert.equal(response.status(),202);
    assert.equal((await response.json()).accepted,true);
    await page.locator('#beta-success').waitFor({state:'visible'});
    assert.equal(await page.locator('#beta-form').isHidden(),true);
    console.log(JSON.stringify({passed:true,liveHttpStatus:response.status(),syntheticRequestId:fixtureId,
      note:'Actual browser POST with preview CSP/CORS; no mock. Remove only this fixture.'}));
  } catch(error) {
    console.log(JSON.stringify({passed:false,syntheticRequestId:fixtureId,error:String(error)}));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
