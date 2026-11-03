// Read-only staging QA. Reuses a private session; never saves real reports.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({storageState:'/private/session.json',viewport:{width:1100,height:900}});
 const page=await context.newPage();
 const timings=[],writes=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',res=>{const r=res.request();if(new URL(res.url()).pathname.startsWith('/api/'))timings.push({path:new URL(res.url()).pathname,status:res.status(),ms:Math.round(Date.now()-r.timing().startTime)});});
 await page.route('**/api/**',route=>{const r=route.request();if(r.method()!=='GET'&&!new URL(r.url()).pathname.endsWith('/canvas-source-preview/')){writes.push(new URL(r.url()).pathname);return route.abort();}return route.continue();});
 let start=Date.now();
 await page.goto('http://127.0.0.1:8091/relatorios?unit=ame');
 await page.locator('.report-table tbody tr').first().waitFor({timeout:60000});
 const listMs=Date.now()-start;
 await page.waitForTimeout(1000);
 const listRequests=timings.map(t=>t.path);
 start=Date.now();
 await page.goto('http://127.0.0.1:8091/relatorios/6/canvas?unit=ame');
 await page.locator('.cv-block').first().waitFor({timeout:60000});
 const editorMs=Date.now()-start;
 start=Date.now();
 await page.getByRole('button',{name:'Dados: Prévia',exact:true}).click();
 await page.locator('.cv-block-table tbody tr').first().waitFor({timeout:60000});
 const previewMs=Date.now()-start;
 const result=await page.evaluate(()=>{
  const table=document.querySelector('.cv-block-table table');
  const headers=[...table.querySelectorAll('th')].map(e=>e.querySelector('span')?.textContent);
  const rows=[...table.querySelectorAll('tbody tr')];
  const boxes=['.cv-topbar','.cv-library','.cv-stage','.cv-inspector'].map(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {selector:s,x:r.x,y:r.y,width:r.width,height:r.height};});
  return {exampleChips:[...document.querySelectorAll('.cv-origin-chip')].filter(e=>e.textContent.includes('Exemplo')).length,rawDates:rows.some(r=>/\d{4}-\d{2}-\d{2}T/.test(r.textContent)),emptyResult:rows.every(r=>r.cells[headers.indexOf('Resultado')]?.textContent==='—'),emptyResponsible:rows.every(r=>r.cells[headers.indexOf('Responsável')]?.textContent==='—'),overflow:document.documentElement.scrollWidth>innerWidth,boxes};
 });
 await page.locator('.cv-block-table').first().click();
 const content=page.getByRole('tab',{name:'Conteúdo',exact:true});
 if(await content.count()) await content.click();
 const fit=page.getByRole('button',{name:'Ajustar altura ao conteúdo',exact:true});
 if(await fit.count()) {
  const b=await fit.boundingBox(),p=await page.locator('.cv-inspector').boundingBox();
  assert.ok(b && p && b.x>=p.x && b.x+b.width<=p.x+p.width+1,'Inspector action must fit at 1100px');
 }
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);await page.screenshot({path:'/evidence/task12-1100-'+theme+'.png',fullPage:true});}
 console.log(JSON.stringify({listMs,editorMs,previewMs,listRequests,...result,timings,writes,errors}));
 if(process.env.VERIFY==='1'){
  assert.equal(result.exampleChips,0);assert.equal(result.rawDates,false);assert.equal(result.emptyResult,true);assert.equal(result.emptyResponsible,true);assert.equal(result.overflow,false);
  const stage=result.boxes.find(b=>b?.selector==='.cv-stage'),inspector=result.boxes.find(b=>b?.selector==='.cv-inspector');
  assert.ok(stage.x+stage.width<=inspector.x+1);assert.ok(inspector.x+inspector.width<=1101);
  assert.ok(!listRequests.some(p=>/\/(appointments|indicators|messages|replies|issues|rules|templates|imports|audit|control)\//.test(p)), "Reports must not load unrelated dashboards");
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
