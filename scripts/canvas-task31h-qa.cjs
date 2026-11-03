// Somente navegação e leitura no staging 8091.
const {chromium}=require('playwright'),fs=require('fs');
(async()=>{
 const base='http://127.0.0.1:8091',dest='/prints';fs.mkdirSync(dest,{recursive:true});const results=[];
 for(const zoom of [.8,1,1.25,1.5])for(const theme of ['light','dark']){
  const b=await chromium.launch({channel:'chromium',args:['--no-sandbox','--force-device-scale-factor='+zoom]});
  const c=await b.newContext({viewport:{width:Math.round(1440/zoom),height:Math.round(1000/zoom)},deviceScaleFactor:zoom,colorScheme:theme});
  await c.addCookies([{name:'sessionid',value:fs.readFileSync('/session','utf8').trim(),url:base}]);
  const p=await c.newPage();await p.addInitScript(t=>localStorage.setItem('orbita-theme',t),theme);
  const r={zoom,theme,checks:[],errors:[]};const check=(ok,msg)=>{if(!ok)throw Error(msg);r.checks.push(msg)};
  async function words(){
   return p.locator('.report-table td:nth-child(2)').evaluateAll(cells=>{
    const broken=[];for(const cell of cells){const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let node;
     while(node=walker.nextNode())for(const match of node.textContent.matchAll(/[\p{L}\p{N}]+/gu)){
      const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
      const lines=new Set([...range.getClientRects()].map(x=>Math.round(x.top)));if(lines.size>1)broken.push(match[0]);
     }
    }return broken;
   });
  }
  try{
   await p.goto(base+'/relatorios?unit=ame');await p.locator('.report-table').waitFor();
   check((await words()).length===0,'Origem sem palavras partidas');
   check(await p.getByRole('button',{name:'Editar relatório',exact:true}).count()>0,'Ação Editar relatório');
   check(await p.locator('.report-tab-count').filter({hasText:/^0$/}).count()===0,'Sem contagem zero');
   await p.screenshot({path:dest+'/'+zoom+'-'+theme+'-lista.png'});
   await p.getByRole('tab',{name:'Conexões',exact:true}).click();await p.locator('.report-table').waitFor();
   await p.getByText('Banco do Órbita',{exact:true}).first().waitFor();check((await words()).length===0,'Banco sem palavras partidas');
   await p.screenshot({path:dest+'/'+zoom+'-'+theme+'-conexoes.png'});
   await p.goto(base+'/relatorios/1/canvas?unit=ame');await p.locator('.cv-stage').waitFor();
   check(!(await p.title()).includes('Canvas'),'Título em português');
   await p.locator('.cv-stage').evaluate(el=>el.focus());
   const header=await p.locator('.cv-topbar').boundingBox();
   // Move through the header, including the space between its two rows.
   for(const fraction of [.25,.5,.75]){
    await p.mouse.move(header.x+header.width*.5,header.y+header.height*fraction);
    for(const key of ['+','-','0']){
     const captured=await p.locator('.cv-stage').evaluate((el,key)=>{const e=new KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented},key);
     check(!captured,'Cabeçalho '+fraction+': Ctrl'+key+' pertence ao navegador');
    }
   }
   await p.locator('.cv-stage').hover();
   for(const key of ['+','-','0']){
    const captured=await p.locator('.cv-stage').evaluate((el,key)=>{const e=new KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented},key);
    check(captured,'Prancha: Ctrl'+key+' capturado');
   }
   await p.screenshot({path:dest+'/'+zoom+'-'+theme+'-editor.png'});
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Página sem rolagem horizontal');
  }catch(e){r.errors.push(e.message);await p.screenshot({path:dest+'/'+zoom+'-'+theme+'-falha.png'}).catch(()=>{})}
  results.push(r);await b.close();fs.writeFileSync(dest+'/matriz.json',JSON.stringify(results,null,2));
 }
 console.log(JSON.stringify(results,null,2));if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
