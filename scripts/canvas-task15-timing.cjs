const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});const runs=[];
 for(let i=0;i<3;i++){
 const context=await browser.newContext({storageState:'/private/session.json',viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.request().method()==='GET'||r.request().url().includes('canvas-source-preview')?r.continue():r.abort());
 const t=Date.now();await page.goto('http://127.0.0.1:8091/relatorios/6/canvas?unit=ame');
 await page.locator('.cv-block').first().waitFor({timeout:60000});const editorMs=Date.now()-t;
 await page.getByRole('button',{name:'Dados reais',exact:true}).click();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.cv-block [role=status]')).some(e=>e.textContent.includes('Carregando prévia')),{},{timeout:60000});
 runs.push({editorMs,realMs:Date.now()-t,errors,resources:await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,start:Math.round(r.startTime),ms:Math.round(r.duration),ttfb:Math.round(r.responseStart-r.requestStart),bytes:r.encodedBodySize}))) });await context.close();
 }
 fs.writeFileSync('/evidence/'+(process.env.RESULT||'timing')+'.json',JSON.stringify(runs,null,2));console.log(JSON.stringify(runs));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
