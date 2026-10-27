// Read-only real staging QA. Only source-preview POSTs are permitted.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({storageState:'/evidence/session.json',viewport:{width:1440,height:1100}});
 const page=await context.newPage();
 const writes=[],errors=[],timings=[],previews=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async res=>{
  const req=res.request(),url=new URL(res.url());
  if(url.pathname.startsWith('/api/'))timings.push({path:url.pathname,status:res.status(),ms:Math.round(Date.now()-req.timing().startTime)});
  if(url.pathname.endsWith('/canvas-source-preview/')) {
   const body=await res.json();
   previews.push({status:res.status(),parameters:req.postDataJSON().source.parameters,rows:body.rows?.length,total:body.total_rows});
  }
 });
 await page.route('**/api/**',route=>{
  const req=route.request();
  if(req.method()!=='GET' && !new URL(req.url()).pathname.endsWith('/canvas-source-preview/')) {writes.push(new URL(req.url()).pathname);return route.abort();}
  return route.continue();
 });
 await page.goto('http://127.0.0.1:8091/relatorios?unit=ame');
 await page.waitForTimeout(18000);
 const listLoading=await page.getByText('Carregando…',{exact:true}).count();
 for(const id of [6,3,2,8,9]){
  const t=Date.now();
  await page.goto('http://127.0.0.1:8091/relatorios/'+id+'/canvas?unit=ame');
  await page.locator('.cv-block').first().waitFor({timeout:60000});
  timings.push({editor:id,ms:Date.now()-t});
  if([6,3].includes(id)){
   await page.getByRole('button',{name:'Dados: Prévia',exact:true}).click();
   await page.locator('.cv-block-table tbody tr').first().waitFor({timeout:60000});
   await page.waitForTimeout(400);
   assert.ok((await page.locator('.cv-origin-chip').filter({hasText:/período.*padrão/}).count())>0);
   assert.equal(await page.locator('.cv-preview-controls[open]').count(),0);
   assert.equal(await page.locator('.cv-block-table tbody tr').count(),50);
   const tableBounds=await page.locator('.cv-block-table').first().boundingBox();
   const wrap=page.locator('.cv-block-table .cv-table-wrap').first();
   const wrapBounds=await wrap.boundingBox();
   assert.ok(wrapBounds.y+wrapBounds.height<=tableBounds.y+tableBounds.height+1,'Table rows must stay inside the block');
   await wrap.evaluate(el=>{el.scrollTop=100;});
   assert.ok(await wrap.evaluate(el=>el.scrollTop>0),'All 50 rows must be reachable by scrolling');
   await wrap.evaluate(el=>{el.scrollTop=0;});
   await page.locator('.cv-block-table').first().click();
   const content=page.getByRole('tab',{name:'Conteúdo',exact:true});
   if(await content.count())await content.click();
   const fit=page.getByRole('button',{name:'Ajustar altura ao conteúdo',exact:true});
   if(await fit.count()){
    const bounds=await fit.boundingBox();
    const panel=await page.locator('.cv-inspector').boundingBox();
    if(bounds&&panel)assert.ok(bounds.x>=panel.x && bounds.x+bounds.width<=panel.x+panel.width+1);
   }
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
    await page.screenshot({path:'/evidence/real-'+id+'-'+theme+'.png',fullPage:true});
   }
   await page.locator('.cv-insp-tab').filter({hasText:/^Dados$/}).click();
   await page.locator('.cv-inspector-scroll').getByText(/Prévia · 50 linhas.*padrão/).waitFor();
   assert.equal(await page.locator('.cv-inspector-scroll .cv-field-error:visible').count(),0);
   await page.locator('.cv-preview-controls summary').first().click();
   await page.locator('.cv-preview-controls input').first().waitFor();
   assert.equal(await page.locator('.cv-unsaved-dot').count(),0);
  }
 }
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 assert.ok(previews.some(p=>p.status===200&&p.rows>0));
 console.log(JSON.stringify({data:'real authenticated session',listLoadingAfter18s:!!listLoading,previews,timings,writes,errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
