// Read-only smoke for the two routes whose chart modules now load on demand.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const checks = [];
  for (const [path, selector, module] of [
    ['/visao-geral', '.operational-overview', 'OverviewWorkspace-'],
    ['/custos-meta', '.finance-workspace', 'MetaCosts-'],
  ]) {
    const context = await browser.newContext({storageState:'/private/session.json',viewport:{width:1100,height:900}});
    const page = await context.newPage(), errors = [], blocked = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**', route => {
      const request = route.request();
      if (request.method() !== 'GET') {blocked.push(new URL(request.url()).pathname); return route.abort();}
      // Exercise rendering without asking the external Meta billing service.
      if (new URL(request.url()).pathname.endsWith('/meta-costs/'))
        return route.fulfill({json:{status:'not_configured',code:'qa',rows:[],checked_at:'',currency:null,total_cost:null,total_volume:null}});
      return route.continue();
    });
    await page.goto('http://127.0.0.1:8091' + path + '?unit=ame');
    await page.locator(selector).waitFor({timeout:60000});
    const resources = await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname));
    assert.ok(resources.some(r=>r.includes(module)),module + ' loads on demand');
    assert.ok(resources.some(r=>r.includes('/charts-')),'charts available in chart routes');
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    checks.push({path,module,rendered:true,errors,blocked});await context.close();
  }
  console.log(JSON.stringify({checks}));await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
