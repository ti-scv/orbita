// GET only. Fresh Chromium contexts, disabled cache, local server, no tunnel.
const {chromium}=require('playwright'),fs=require('fs');
(async()=>{
 const base=process.env.CANVAS_QA_URL||'http://127.0.0.1:8091';
 const dest=process.env.QA_DEST||'/prints';fs.mkdirSync(dest,{recursive:true});
 const b=await chromium.launch({args:['--no-sandbox']});const result=[];
 for(const [name,path,ready] of [['lista','/relatorios?unit=ame','.report-table'],['editor','/relatorios/1/canvas?unit=ame','.cv-stage']]){
  const c=await b.newContext({recordHar:{path:dest+'/'+name+'.har',content:'omit'},viewport:{width:1440,height:900}});
  await c.addCookies([{name:'sessionid',value:fs.readFileSync('/session','utf8').trim(),url:base}]);
  const p=await c.newPage(),d=await c.newCDPSession(p),requests=new Map();
  await d.send('Network.enable');await d.send('Network.setCacheDisabled',{cacheDisabled:true});
  d.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{url:e.request.url,start:e.timestamp,initiator:e.initiator.type,method:e.request.method}));
  d.on('Network.responseReceived',e=>Object.assign(requests.get(e.requestId)||{},{status:e.response.status,mime:e.response.mimeType,headers:e.response.headers}));
  d.on('Network.loadingFinished',e=>Object.assign(requests.get(e.requestId)||{},{end:e.timestamp,bytes:e.encodedDataLength}));
  await c.tracing.start({screenshots:false,snapshots:false});
  const start=Date.now();await p.goto(base+path);await p.locator(ready).waitFor();const readyMs=Date.now()-start;
  await p.waitForTimeout(4000);
  const all=[...requests.values()],t0=Math.min(...all.map(r=>r.start));
  const rows=all.map(r=>({path:r.url.startsWith('data:')?'data:[embedded]':r.url.replace(base,''),method:r.method,status:r.status,mime:r.mime,startMs:Math.round((r.start-t0)*1000),durationMs:r.end?Math.round((r.end-r.start)*1000):null,bytes:r.bytes||0,initiator:r.initiator,encoding:r.headers?.['Content-Encoding']||r.headers?.['content-encoding']||'',cacheControl:r.headers?.['Cache-Control']||r.headers?.['cache-control']||''}));
  result.push({name,readyMs,count:rows.length,bytes:rows.reduce((s,r)=>s+r.bytes,0),requests:rows});
  await c.tracing.stop({path:'/tmp/31h-'+name+'-trace.zip'});await c.close();
  // HAR may contain auth cookies: retain only timings/URLs/size, never credentials.
  const har=JSON.parse(fs.readFileSync(dest+'/'+name+'.har'));
  for(const e of har.log.entries){e.request.headers=[];e.request.cookies=[];e.response.headers=[];e.response.cookies=[];}
  fs.writeFileSync(dest+'/'+name+'.har',JSON.stringify(har,null,2));
 }
 fs.writeFileSync(dest+'/waterfall.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
