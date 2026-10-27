const fs=require('node:fs'), http=require('node:http');
(async()=>{
 const state=JSON.parse(fs.readFileSync('/private/session.json'));
 const cookie=state.cookies.map(c=>c.name+'='+c.value).join('; ');
 const out=[];
 for(let n=1;n<=4;n++){
  const start=performance.now();
  const result=await new Promise((resolve,reject)=>{
   http.get('http://orbita-canvas-stage-api-qa14:8000/api/v1/reports/?unit=ame&section=reports',{headers:{Cookie:cookie,Host:'127.0.0.1'}},r=>{
    let text='';r.on('data',c=>text+=c);r.on('end',()=>resolve({status:r.statusCode,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(text),rows:r.statusCode===200?JSON.parse(text).results?.length:0}));
   }).on('error',reject);
  });out.push({run:n,...result});
 }
 console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
