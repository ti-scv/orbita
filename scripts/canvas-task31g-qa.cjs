const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const base='http://127.0.0.1:8097', dest='/prints', ids=JSON.parse(fs.readFileSync('/ids'));
(async()=>{fs.mkdirSync(dest,{recursive:true});let results=[];
for(const zoom of [.8,1,1.25,1.5]) for(const theme of ['light','dark']) {
 const b=await chromium.launch({channel:'chromium',args:['--no-sandbox',`--force-device-scale-factor=${zoom}`]});
 const c=await b.newContext({viewport:{width:Math.round(1440/zoom),height:Math.round(1000/zoom)},deviceScaleFactor:zoom,colorScheme:theme});await c.addCookies([{name:'sessionid',value:fs.readFileSync('/session','utf8').trim(),url:base}]);
 const p=await c.newPage();await p.addInitScript(t=>localStorage.setItem('orbita-theme',t),theme);let r={zoom,theme,checks:[],errors:[]};
 const check=(ok,msg)=>{if(!ok)throw Error(msg);r.checks.push(msg)};
 async function capture(name){await p.screenshot({path:path.join(dest,`${zoom}-${theme}-${name}.png`)});const x=await p.evaluate(()=>({width:innerWidth,scale:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth+1, title:[...document.querySelectorAll('.cv-report-title')].map(e=>({text:e.textContent,tip:e.title,overflow:e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1||e.getBoundingClientRect().top<e.closest("header").getBoundingClientRect().top||e.getBoundingClientRect().bottom>e.closest("header").getBoundingClientRect().bottom}))}));check(!x.overflow,`${name}: sem rolagem horizontal da página`);check(x.title.every(t=>!t.overflow&&t.tip===t.text),`${name}: título visível e completo`);r.metrics=x}
 try {
 await p.goto(base+'/relatorios?unit=qa31d');await p.locator('.report-table').waitFor();await capture('lista');
 check(await p.getByText('Desative o relatório antes de removê-lo.').count()>0,'motivo visível para relatório ativo');
 for(const label of ['Relatórios removidos']){await p.getByText(label,{exact:true}).click();await p.getByText('A remoção está desativada. Entre em contato com o administrador para solicitar a liberação.').waitFor();check(true,label+' carregado')}
 await p.getByRole('tab',{name:'Conexões',exact:true}).click();await p.locator('.report-table').waitFor();await capture('conexoes');await p.getByText('Conexões removidas',{exact:true}).click();await p.getByText('A remoção está desativada. Entre em contato com o administrador para solicitar a liberação.').waitFor();check(true,'Conexões removidas carregado');
 await p.goto(`${base}/relatorios/${ids.draft31d}/canvas?unit=qa31d`);await p.locator('.cv-workspace').waitFor();await capture('editor');
 await p.getByRole('button',{name:'Código do relatório'}).click();await p.getByRole('dialog',{name:'Código do relatório (avançado)'}).waitFor();await capture('codigo');await p.getByRole('button',{name:'Fechar'}).click();
 if(await p.getByRole('button',{name:'Mais ações',exact:true}).isVisible()){await p.getByRole('button',{name:'Mais ações',exact:true}).click();await p.getByRole('menuitem',{name:'Testar relatório',exact:true}).click()}else await p.getByRole('button',{name:'Testar relatório',exact:true}).click();await capture('dialogo');
 const resp=p.waitForResponse(r=>r.url().includes('/canvas-preview/')&&r.request().method()==='POST');await p.getByRole('button',{name:'Gerar prévia',exact:true}).click();const json=await(await resp).json();check(!!json.content,'prévia PDF gerada');fs.writeFileSync(path.join(dest,`${zoom}-${theme}.pdf`),Buffer.from(json.content,'base64'));await p.getByRole('button',{name:'Atualizar prévia',exact:true}).waitFor();await capture('previa');
 await p.goto(`${base}/relatorios/${ids.draft31d}/previa?unit=qa31d&xyz=1`);await p.getByText(/Este parâmetro não existe neste relatório/).waitFor();await capture('parametro');
 } catch(e){r.errors.push(e.message);await p.screenshot({path:path.join(dest,`${zoom}-${theme}-falha.png`)}).catch(()=>{})} results.push(r);await b.close();fs.writeFileSync(path.join(dest,'matriz.json'),JSON.stringify(results,null,2));}
 console.log(JSON.stringify(results,null,2));if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
