const {chromium}=require('playwright'), fs=require('fs');
(async()=>{
 const session=fs.readFileSync('/qa/session','utf8').match(/SESSION33E\s+(\S+)/)[1], base='http://127.0.0.1:8095';
 const browser=await chromium.launch({args:['--no-sandbox']});
 for(const theme of ['light','dark']) for(const zoom of [1,1.5]) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'sessionid',value:session,url:base}]);
  const page=await context.newPage(); await page.addInitScript(t=>localStorage.setItem('orbita-theme',t),theme);
  await page.goto(`${base}/relatorios?unit=qa33e`);
  await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
  await page.getByRole('button',{name:'Editar Composição QA 33e'}).click({timeout:30000});
  const dialog=page.getByRole('dialog',{name:/Editar · Relatórios/});
  await dialog.getByLabel('Buscar relatórios por nome').fill('Vendas QA');
  await dialog.getByRole('button',{name:/Adicionar Vendas QA 33e ID/}).first().waitFor();
  await dialog.locator('.report-composition').scrollIntoViewIfNeeded();
  await page.screenshot({path:`/prints/33e-${theme}-${zoom===1?100:150}.png`});
  if(theme==='light' && zoom===1){
    await dialog.getByRole('button',{name:/Adicionar Vendas QA 33e ID/}).first().click();
    await dialog.getByRole('button',{name:/Subir Vendas QA 33e posição 2/}).click();
    await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
    await dialog.waitFor({state:'hidden'}); await page.reload();
    await page.getByRole('button',{name:'Editar Composição QA 33e'}).click();
    const d=page.getByRole('dialog',{name:/Editar · Relatórios/});
    await d.getByRole('button',{name:/Subir Vendas QA 33e posição 2/}).waitFor();
    console.log('Composição salva, ordem persistida e reaberta.');
  }
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
