const {chromium} = require('playwright'), fs = require('fs');
(async () => {
 const session = fs.readFileSync('/qa/session33i', 'utf8').trim().split(/\s+/).pop(), base = 'http://127.0.0.1:8101';
 const browser = await chromium.launch({args:['--no-sandbox']});
 for (const theme of ['light', 'dark']) for (const zoom of [1, 1.5]) {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'sessionid',value:session,url:base}]);
  const page = await context.newPage();
  await page.addInitScript(t => localStorage.setItem('orbita-theme', t), theme);
  await page.goto(base + '/relatorios?unit=qa33i');
  await page.evaluate(z => document.documentElement.style.zoom = String(z), zoom);
  await page.getByRole('button',{name:'Editar Composição QA 33i'}).click({timeout:30000});
  const dialog = page.getByRole('dialog',{name:/Editar · Relatórios/});
  await dialog.getByLabel('Buscar relatórios por nome').fill('Vendas QA 33i');
  await dialog.getByRole('list',{name:'Resultados da busca · Outra unidade QA 33i'}).waitFor();
  await dialog.locator('.report-composition').scrollIntoViewIfNeeded();
  await page.screenshot({path:`/prints/33i-${theme}-${zoom === 1 ? 100 : 150}.png`});
  if (theme === 'dark' && zoom === 1.5) {
   await page.evaluate(() => document.documentElement.style.zoom = '1');
   await dialog.getByRole('list',{name:'Resultados da busca · Outra unidade QA 33i'}).getByRole('button',{name:/Adicionar/}).click();
   await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   await page.reload();
   await page.getByRole('button',{name:'Editar Composição QA 33i'}).click();
   await page.getByRole('dialog',{name:/Editar · Relatórios/}).getByText(/Outra unidade QA 33i.*ID/).waitFor();
   console.log('Componente de outra unidade salvo e reaberto.');
  }
  await context.close();
 }
 await browser.close();
})().catch(e => {console.error(e); process.exit(1)});

