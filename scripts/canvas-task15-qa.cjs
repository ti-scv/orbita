// Read-only browser QA. Never saves reports; only source-preview POSTs are allowed.
const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});const checks=[];const errors=[];const blocked=[];
 const context=await browser.newContext({storageState:'/private/session.json',viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 let delay=false;await page.route('**/api/**',async r=>{const req=r.request();if(req.method()==='GET')return r.continue();if(req.method()==='POST'&&req.url().includes('/canvas-source-preview/')){if(delay)await new Promise(r=>setTimeout(r,1000));return r.continue();}blocked.push(new URL(req.url()).pathname);return r.abort();});
 async function audit(label){const unlabeled=await page.locator('button').evaluateAll(bs=>bs.filter(b=>!b.disabled&&b.getClientRects().length&&!(b.getAttribute('aria-label')||b.title||b.textContent.trim())).map(b=>b.outerHTML.slice(0,250)));assert.deepEqual(unlabeled,[],label);checks.push({label,unlabeled:0});}
 for(const id of [6,8]){
 const url=`http://127.0.0.1:8091/api/v1/reports/${id}/canvas/?unit=ame`;const before=await (await context.request.get(url)).json();
 await page.goto(`http://127.0.0.1:8091/relatorios/${id}/canvas?unit=ame`);await page.locator('.cv-block').first().waitFor();
 const theme=page.locator('.cv-theme-toggle');for(let n=0;n<3&&await page.locator('html').getAttribute('data-theme')!=='dark';n++)await theme.click();
 assert.match(await theme.getAttribute('title'),/Clique para alternar/);
 const pub=page.getByRole('button',{name:/Publicação: abrir/});assert.match(await pub.getAttribute('title'),/aplicadas ao salvar/);await pub.click();await audit(`${id} publicação`);await pub.click();
 delay=true;await page.getByRole('button',{name:'Dados reais',exact:true}).click();await page.locator('.cv-block-status-inline').first().waitFor();
 const loading=await page.locator('.cv-block-status-inline').first().evaluate(e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,color:s.color,token:s.getPropertyValue('--cv-surface-3').trim()}});assert.equal(loading.bg,'rgb(28, 33, 40)');
 await page.screenshot({path:`/evidence/${id}-dark-loading.png`});
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.cv-block [role=status]')).some(e=>e.textContent.includes('Carregando prévia')),{},{timeout:60000});delay=false;
 await audit(`${id} canvas`);
 const table=page.locator('.cv-table-preview tbody').first();const stageRows=await table.locator('tr').allTextContents();
 await page.locator('.cv-rail').getByRole('tab',{name:'Dados',exact:true}).click();
 const row=page.locator('.cv-source-row').first();await row.hover();await row.getByRole('button',{name:/Ver dados/}).click();
 await page.locator('.cv-data-drawer tbody tr').first().waitFor();const drawerRows=await page.locator('.cv-data-drawer tbody tr').allTextContents();
 // Same source response and sequence; table may show fewer columns or rows.
 const data=await page.evaluate(()=>({stage:Array.from(document.querySelectorAll('.cv-table-preview tbody tr')).map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>td.textContent.trim())),drawer:Array.from(document.querySelectorAll('.cv-data-drawer tbody tr')).map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>td.textContent.trim()))}));
 assert.ok(data.stage.length>0);for(let n=0;n<data.stage.length;n++)for(const cell of data.stage[n])assert.ok(data.drawer[n]?.includes(cell),`ordem divergente linha ${n}`);
 await audit(`${id} gaveta`);await page.screenshot({path:`/evidence/${id}-dark-drawer.png`});
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 for(const tab of ['Adicionar','Estrutura','Imagens']){const t=page.locator('.cv-rail').getByRole('tab',{name:tab,exact:true});if(await t.count()){await t.click();await audit(`${id} ${tab}`);}}
 const after=await (await context.request.get(url)).json();assert.deepEqual(after,before);
 checks.push({id,loading,stageRows:stageRows.length,drawerRows:drawerRows.length,order:true,configUnchanged:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);fs.writeFileSync('/evidence/browser.json',JSON.stringify({checks,errors,blocked},null,2));console.log(JSON.stringify({checks,errors,blocked}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
