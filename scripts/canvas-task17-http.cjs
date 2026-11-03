// Validate the staging delivery contract without reading private API bodies.
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.QA_BASE||'http://127.0.0.1:8091';
 const html=await fetch(base+'/relatorios/323/canvas?unit=scv');assert.equal(html.status,200);
 const asset=(await html.text()).match(/src="(\/assets\/[^" ]+\.js)"/)[1];
 const response=await fetch(base+asset,{headers:{'Accept-Encoding':'gzip'}});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-encoding'),'gzip');
 assert.match(response.headers.get('cache-control'),/max-age=31536000/);
 assert.match(response.headers.get('cache-control'),/immutable/);
 const missing=await fetch(base+'/assets/task17-missing.js');assert.equal(missing.status,404);
 const api=await fetch(base+'/api/v1/auth/csrf/');assert.equal(api.status,200);
 assert.doesNotMatch(api.headers.get('cache-control')||'',/immutable/);
 console.log(JSON.stringify({html:html.status,asset,gzip:true,cache:response.headers.get('cache-control'),missing:missing.status,apiCache:api.headers.get('cache-control')}));
})().catch(e=>{console.error(e);process.exit(1)});
