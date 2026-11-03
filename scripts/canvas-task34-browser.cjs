const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{const base='http://127.0.0.1:8098',b=await chromium.launch({headless:true,args:['--no-sandbox']}), results=[];
for(const id of [57,1]) for(const theme of ['light','dark']) for(const zoom of [1,1.5]){
 const c=await b.newContext({viewport:{width:Math.round(1440/zoom),height:Math.round(1000/zoom)},deviceScaleFactor:zoom}); await c.addCookies([{name:'sessionid',value:fs.readFileSync('/session','utf8').trim(),url:base}]); const p=await c.newPage(); const result={id,theme,zoom};
 try {await p.goto(`${base}/relatorios/${id}/canvas?unit=${id===57?'scv':'ame'}`); await p.locator('.cv-workspace').waitFor({timeout:30000});
 for(let n=0;n<3 && await p.locator('html').getAttribute('data-theme')!==theme;n++)await p.locator('.cv-theme-toggle').click();
 await p.locator('.cv-rail').getByRole('tab',{name:'Dados',exact:true}).click(); await p.getByRole('button',{name:'Adicionar fonte',exact:true}).first().click(); await p.getByRole('dialog',{name:'Adicionar fonte de dados'}).waitFor();
 await p.getByRole('combobox',{name:'Relatório cadastrado na unidade'}).click(); await p.screenshot({path:`/prints/c${id}-${theme}-${zoom}-lista.png`});
 const options=await p.getByRole('option').allTextContents(); result.options=options; if(id===57 && options.some(x=>x.includes('Jales')))throw Error('Filtro não escondeu Jales');
 if(id===57){await p.keyboard.press('Escape');await p.getByLabel('Mostrar de outras unidades').check();await p.getByRole('combobox',{name:'Relatório cadastrado na unidade'}).click();if(!(await p.getByRole('option').allTextContents()).some(x=>x.includes('Jales')))throw Error('Outra unidade não encontrada');}
 await p.keyboard.press('Escape');
 }catch(e){result.error=e.message;await p.screenshot({path:`/prints/c${id}-${theme}-${zoom}-erro.png`}).catch(()=>{});} results.push(result); await c.close();}
 fs.writeFileSync('/prints/resultados.json',JSON.stringify(results,null,2)); console.log(JSON.stringify(results));await b.close(); if(results.some(x=>x.error))process.exitCode=1;
})();
