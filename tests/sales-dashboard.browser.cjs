// Run against the documented local server: node tests/sales-dashboard.browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    await page.clock.install({time:new Date('2026-10-26T01:00:00Z')});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.AX_BASE_URL || 'http://127.0.0.1:8000/');
    assert.match(await page.locator('#roles .selected').innerText(),/마케팅/);
    assert.match(await page.locator('#roles button').last().innerText(),/전체/);
    assert.equal(await page.locator('#cards .card').count(),3);
    await page.locator('#roles [data-role="전체"]').click();
    assert.equal(await page.locator('.catalog-row').count(),9);
    assert.match(await page.locator('.catalog-row').first().innerText(),/마케팅/);
    await page.locator('nav [data-view="insights"]').click();
    assert.equal(await page.locator('#salesDashboard').isVisible(),true);
    assert.equal(await page.locator('#salesBreakdown tbody tr').count(),9);
    assert.doesNotMatch(await page.locator('#salesDashboard').innerText(),/백만원/);
    for (const period of ['day','quarter','ytd','month']) {
      await page.locator(`[data-sales-period="${period}"]`).click();
      assert.equal(await page.locator(`[data-sales-period="${period}"]`).getAttribute('aria-pressed'),'true');
    }
    await page.locator('#salesRevenueTarget').fill('10');
    await page.locator('#salesProfitTarget').fill('1');
    assert.match(await page.locator('#salesGoals').innerText(),/-2.46억원/);
    await page.locator('#salesDate').fill('2026-10-25');
    await page.locator('#salesDate').dispatchEvent('change');
    assert.equal(await page.locator('#salesRevenueTarget').inputValue(),'10','same monthly target across business dates');
    await page.locator('#salesDate').fill('2026-10-26');
    await page.locator('#salesDate').dispatchEvent('change');
    await page.locator('#salesProduct').selectOption('bags');
    await page.locator('#salesChannel').selectOption('offline');
    assert.equal(await page.locator('#salesBreakdown tbody tr').count(),1);
    await page.locator('#salesProduct').selectOption('all');
    await page.locator('#salesChannel').selectOption('all');
    for (const tab of ['profit','logistics','products','customer','sales']) {
      await page.locator(`[data-analysis="${tab}"]`).click();
      assert.equal(await page.locator('#salesDashboard').isVisible(),tab==='sales');
    }
    console.log('PASS home roles, periods/filters, target units/persistence, legacy analysis tabs');

    const row=(id,date,sales,operatingProfit,product='jewelry',channel='online')=>({id,date,sales,operatingProfit,product,channel});
    let response={asOf:'2026-10-26T10:00:00+09:00',records:[row('q1','2026-01-01',1e8,1e7),row('q2','2026-04-01',2e8,-2e7,'bags','offline'),row('q3','2026-07-01',3e8,null,'romanson','global'),row('oct','2026-10-01',4e8,4e7),row('today','2026-10-26',5e8,5e7,'bags','offline'),row('refund','2026-10-26',-1e8,-1e7)]};
    let calls=0,fail=false;
    await page.route('**/api/erp/sales?*',route=>{calls++;return route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(response)});});
    await page.locator('#salesMode').selectOption('erp');
    await page.waitForFunction(()=>document.querySelector('#salesSource').textContent==='ERP 수신 데이터');
    assert.equal(await page.locator('#salesRevenueTarget').inputValue(),'0','sample goal never becomes an ERP plan');
    assert.match(await page.locator('#salesSummary [data-summary-period="month"] strong').innerText(),/^8/);
    assert.match(await page.locator('#salesSummary [data-summary-period="ytd"] .sales-card-profit').innerText(),/미집계/);
    const negative=page.locator('rect[data-quarter="2"][data-series="operatingProfit"]');
    assert.equal(await negative.getAttribute('data-value'),'-20000000');
    assert.equal(await page.locator('rect[data-quarter="3"][data-series="operatingProfit"]').count(),0);
    await page.locator('#salesRevenueTarget').fill('10');
    await page.locator('#salesProfitTarget').fill('1');
    assert.match(await page.locator('#salesGoals').innerText(),/달성률 80%/);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#exportSales').click();
    const download=await downloadPromise;
    const csv=fs.readFileSync(await download.path(),'utf8');
    assert.match(csv, /"금액 단위","억원"/);
    assert.match(csv, /"합계","","8","0.8"/);
    response.records[4].sales=6e8;
    await page.clock.fastForward(60000);
    await page.waitForFunction(()=>document.querySelector('#salesSummary [data-summary-period="month"] strong').textContent.startsWith('9'));
    assert.ok(calls>=2,'ERP polling executed');
    assert.equal(await page.locator('#salesRevenueTarget').inputValue(),'10');
    fail=true;
    await page.locator('#refreshSales').click();
    await page.waitForFunction(()=>document.querySelector('#salesConnection').textContent.includes('실패'));
    assert.match(await page.locator('#salesConnection').innerText(),/마지막 수신/);
    assert.match(await page.locator('#salesSummary [data-summary-period="month"] strong').innerText(),/^9/);
    fail=false;response.records.push({...response.records[0]});
    await page.locator('#refreshSales').click();
    await page.waitForFunction(()=>!document.querySelector('#refreshSales').disabled);
    assert.match(await page.locator('#salesConnection').innerText(),/실패/);
    assert.match(await page.locator('#salesSummary [data-summary-period="month"] strong').innerText(),/^9/);
    response={asOf:'2026-10-26T10:02:00+09:00',records:[row('max','2026-10-26',Number.MAX_SAFE_INTEGER,0),row('extra','2026-10-26',1,0)]};
    await page.locator('#refreshSales').click();
    await page.waitForFunction(()=>!document.querySelector('#refreshSales').disabled);
    assert.match(await page.locator('#salesConnection').innerText(),/실패/);
    assert.match(await page.locator('#salesSummary [data-summary-period="month"] strong').innerText(),/^9/);
    response={asOf:'2026-10-26T10:02:00+09:00',records:[]};
    await page.locator('#refreshSales').click();
    await page.waitForFunction(()=>!document.querySelector('#refreshSales').disabled);
    assert.match(await page.locator('#salesSummary [data-summary-period="month"] strong').innerText(),/미집계/);
    console.log('PASS mocked ERP success, refunds/loss/missing profit, CSV, 60s polling, failed/invalid/overflow/empty snapshots');

    await page.locator('#salesMode').selectOption('demo');
    await page.locator('#salesDate').fill('2026-03-01');
    await page.locator('#salesDate').dispatchEvent('change');
    assert.doesNotMatch(await page.locator('#salesQuarterTable').innerText(),/null/);
    assert.match(await page.locator('#salesQuarterTable').innerText(),/집계 전/);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'/tmp/jestina-sales-mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('PASS future quarters, mobile layout, zero browser errors');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
