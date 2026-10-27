// Read-only QA: real report layouts, synthetic preview values, no report writes.
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const isBefore=process.env.PHASE==="before";
const longLabels=process.env.LONG_LABELS==="1";
const phase=(longLabels?"long-":"")+(isBefore?"before":"after");
const base=process.env.QA_BASE||"http://127.0.0.1:8091";
(async()=>{
 const browser=await chromium.launch({args:["--no-sandbox"]});const checks=[],errors=[],writes=[];
 for(const id of [6,8])for(const width of [1100,1440])for(const theme of ["light","dark"]){
  const context=await browser.newContext({storageState:"/private/session.json",viewport:{width,height:1000}});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on("pageerror",e=>errors.push(e.message));
  const configURL=`${base}/api/v1/reports/${id}/canvas/?unit=ame`;
  const original=await (await context.request.get(configURL)).json();
  await page.route("**/api/**",async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(req.method()!=="GET"&&!path.endsWith("/canvas-source-preview/")){writes.push(path);return route.abort();}
   // Query real metadata/shape but replace all example values before rendering/capturing.
   const response=await route.fetch();
   if(path.endsWith("/canvas-source-preview/")){
    assert.equal(response.status(),200,"preview query succeeds");
    const data=await response.json();assert.ok(data.columns?.length);if(data.columns){data.rows=Array.from({length:5},(_,n)=>data.columns.map(c=>c.type==="number"?n+1:c.type==="date"||c.type==="datetime"?"2026-09-21 00:00:00":c.type==="boolean"?true:"Exemplo QA"));data.columns=data.columns.map(c=>({...c,sample:[c.type==="date"||c.type==="datetime"?"2026-09-21 00:00:00":c.type==="number"?"12":"Exemplo QA"]}));data.total_rows=5;data.truncated=false;}return route.fulfill({response,json:data});
   }
   if(longLabels && /\/reports\/\d+\/(canvas\/)?$/.test(path)){
    const data=await response.json();const name="AME JALES - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP";
    if(data.name)data.name=name;
    if(data.sources)data.sources=data.sources.map(s=>({...s,name}));
    if(data.layout?.sources)data.layout.sources=data.layout.sources.map(s=>({...s,label:name}));
    return route.fulfill({response,json:data});
   }
   return route.fulfill({response});
  });
  await page.goto(`${base}/relatorios/${id}/canvas?unit=ame`);await page.locator(".cv-block").first().waitFor();
  for(let n=0;n<3&&await page.locator("html").getAttribute("data-theme")!==theme;n++)await page.locator(".cv-theme-toggle").click();
  const dataTab=page.locator(".cv-rail").getByRole("tab",{name:"Dados",exact:true});
  await dataTab.click();assert.equal(await page.locator(".cv-data-panel").isVisible(),true,"first click opens Dados");
  if(!isBefore){
   await dataTab.click();assert.equal(await page.locator(".cv-data-panel").isVisible(),true,"reselect keeps Dados open");
   await page.locator(".cv-rail").getByRole("tab",{name:"Imagens",exact:true}).click();await dataTab.click();assert.equal(await page.locator(".cv-data-panel").isVisible(),true);
  }
  await page.getByRole("button",{name:"Dados reais",exact:true}).click();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll(".cv-block [role=status]")).some(e=>e.textContent.includes("Carregando prévia")));
  const row=page.locator(".cv-source-row").first();
  await page.locator(".cv-left-panel").screenshot({path:`/evidence/${phase}-${id}-${width}-${theme}-preexpand.png`});
  if(await row.getAttribute("aria-expanded")!=="true")await row.locator(".cv-source-chevron").click();await page.locator(".cv-column-row").first().waitFor();
  await page.locator(".cv-left-panel").screenshot({path:`/evidence/${phase}-${id}-${width}-${theme}-sources.png`});
  const sample=await page.locator(".cv-column-sample").allTextContents();
  const metrics=await page.locator(".cv-column-row").evaluateAll(es=>es.map(e=>({h:e.getBoundingClientRect().height,overflow:e.scrollHeight>e.clientHeight+1})));
  const overlaps=await row.evaluate(e=>{const a=e.querySelector(".cv-source-actions").getBoundingClientRect(),t=e.querySelector(".cv-source-title-line").getBoundingClientRect();return a.top<t.bottom&&a.bottom>t.top&&a.left<t.right&&a.right>t.left});
  if(!isBefore)assert.equal(overlaps,false,"source actions do not cover its title");
  await row.hover();await row.getByRole("button",{name:/Ver dados/}).click();await page.locator(".cv-data-drawer tbody tr").first().waitFor();
  await page.locator(".cv-data-drawer").screenshot({path:`/evidence/${phase}-${id}-${width}-${theme}-drawer.png`});await page.getByRole("button",{name:"Fechar",exact:true}).click();
  await page.locator(".cv-rail").getByRole("tab",{name:"Estrutura",exact:true}).click();
  await page.locator(".cv-left-panel").screenshot({path:`/evidence/${phase}-${id}-${width}-${theme}-blocks.png`});
  const table=page.locator(".cv-block-table").first();await table.click({position:{x:20,y:20}});
  await page.locator(".cv-inspector").getByRole("tab",{name:"Conteúdo",exact:true}).click();
  await page.locator(".cv-table-col-item").first().scrollIntoViewIfNeeded();
  await page.screenshot({path:`/evidence/${phase}-${id}-${width}-${theme}-canvas.png`});
  await page.locator(".cv-inspector").screenshot({path:`/evidence/${phase}-${id}-${width}-${theme}-columns.png`});
  const columns=await page.locator(".cv-table-col-item").evaluateAll(es=>es.map(e=>{
   const r=e.getBoundingClientRect(),p=e.querySelector(".cv-column-origin"),s=getComputedStyle(p),b=p.getBoundingClientRect();
   return {height:r.height,overflow:e.scrollHeight>e.clientHeight+1,pathHeight:b.height,pathLine:s.lineHeight,nowrap:s.whiteSpace,title:!!p.title,inside:b.bottom<=r.bottom+1&&b.top>=r.top};
  }));
  await page.locator(".cv-inspector").getByRole("tab",{name:"Dados",exact:true}).click();
  const combo=page.locator(".cv-inspector [role=combobox]").first();await combo.click();await page.locator(".cv-col-popup").waitFor();
  await page.locator(".cv-col-popup").screenshot({path:`/evidence/${phase}-${id}-${width}-${theme}-picker.png`});
  const options=await page.locator(".cv-col-option").evaluateAll(es=>es.map(e=>({height:e.clientHeight,overflow:e.scrollHeight>e.clientHeight+1})));
  if(!isBefore){
   for(const c of columns){assert.ok(c.height>=48);assert.equal(c.nowrap,"nowrap");assert.equal(c.overflow,false);assert.equal(c.inside,true);assert.equal(c.title,true);}
   assert.ok(metrics.every(c=>c.h>=32&&!c.overflow));
   assert.ok(options.every(c=>c.height>=28&&!c.overflow));
   assert.ok(sample.includes("21/09/2026"),"date sample displayed");
   assert.ok(!sample.some(s=>s.includes("2026-09-21")),"sample dates localized");
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(await (await context.request.get(configURL)).json(),original);
  checks.push({id,width,theme,firstClick:true,sampleDatesLocalized:!sample.some(s=>s.includes("2026-09-21")),metrics,columns,options,sourceActionsOverlap:overlaps,configUnchanged:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 fs.writeFileSync(`/evidence/${phase}-browser.json`,JSON.stringify({checks,errors,writes},null,2));console.log(JSON.stringify({phase,combinations:checks.length,errors,writes}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
