// Read-only browser timing. Private session mount; record paths/timings only.
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});const runs=[];
 for(const id of [323,326,6,8]){
 const context=await browser.newContext({storageState:'/private/session.json',viewport:{width:1440,height:1000}});
 for(let n=1;n<=2;n++){
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // No interactions write data; keep HTTP cache enabled for the warm run.
 page.on('request',r=>{if(r.url().includes('/api/') && r.method()!=='GET') errors.push('Unexpected write: '+new URL(r.url()).pathname);});
 if(process.env.THROTTLE){const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:250000,uploadThroughput:125000});}
 const t=Date.now();await page.goto(`${process.env.QA_BASE||'http://127.0.0.1:8091'}/relatorios/${id}/canvas?unit=${id < 10 ? "ame" : "scv"}`,{waitUntil:"domcontentloaded"});
 await page.locator('.cv-workspace').waitFor({timeout:90000});
 await page.getByRole('button',{name:'Dados reais',exact:true}).waitFor();
 await page.getByRole('button',{name:'Aumentar zoom',exact:true}).click();
 if(process.env.ASSERT_BUDGET && Date.now()-t >= (n===1?10000:5000)) throw new Error(`Budget exceeded: report ${id} run ${n}`);
 if(errors.length) throw new Error(errors.join('; '));
 runs.push({id,run:n,editorMs:Date.now()-t,errors,resources:await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,start:Math.round(r.startTime),ms:Math.round(r.duration),ttfb:Math.round(r.responseStart-r.requestStart),bytes:r.encodedBodySize,transfer:r.transferSize}))) });
 console.log(JSON.stringify(runs[runs.length-1]));fs.writeFileSync("/evidence/"+(process.env.RESULT||"before")+".json",JSON.stringify(runs,null,2)); await page.close();
 }
 await context.close();
 }
 fs.writeFileSync('/evidence/'+(process.env.RESULT||'before')+'.json',JSON.stringify(runs,null,2));console.log(JSON.stringify(runs));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
