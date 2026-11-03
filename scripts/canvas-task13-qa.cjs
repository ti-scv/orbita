// Read-only QA against staging; all mutating API requests are aborted.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({storageState:'/private/session.json',viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{
  window.canvasEmptyBodies=0;
  addEventListener('DOMContentLoaded',()=>{
   new MutationObserver(()=>{if(window.canvasWatch && !document.body.innerText.trim())window.canvasEmptyBodies++;}).observe(document.body,{subtree:true,childList:true,characterData:true});
  });
 });
 const page=await context.newPage();const errors=[],consoleErrors=[],blocked=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.route('**/api/**',route=>{
  const r=route.request();if(['POST','PUT','PATCH','DELETE'].includes(r.method())){blocked.push({method:r.method(),path:new URL(r.url()).pathname});return route.abort('blockedbyclient');}
  return route.continue();
 });
 async function healthy(label){
  await page.waitForTimeout(100);
  assert.ok((await page.locator('body').innerText()).trim().length>0,label+': body vazio');
  assert.equal(await page.getByText('Algo deu errado nesta tela. Seus dados não foram perdidos.',{exact:true}).count(),0,label+': boundary acionado');
  assert.deepEqual(errors,[],label+': erro JS');assert.equal(await page.evaluate(()=>window.canvasEmptyBodies),0,label+': body vazio durante transição');checks.push(label);console.log("OK "+label);
 }
 for(const id of [6,8,9]){
  const canvasUrl=`http://127.0.0.1:8091/api/v1/reports/${id}/canvas/?unit=ame`;
  const before=await context.request.get(canvasUrl);assert.equal(before.status(),200);const original=await before.json();
  await page.goto(`http://127.0.0.1:8091/relatorios/${id}/canvas?unit=ame`);
  await page.locator('.cv-block').first().waitFor({timeout:60000});await page.evaluate(()=>{window.canvasWatch=true;});await healthy(`${id}: abrir`);
  await page.locator('.cv-rail').getByRole('tab',{name:'Dados',exact:true}).click();
  const row=page.locator('.cv-source-row').first();await row.hover();
  const label=await row.locator('.cv-source-label').innerText();
  await row.getByRole('button',{name:`Editar fonte ${label}`,exact:true}).click();
  await page.getByRole('dialog',{name:'Editar fonte de dados',exact:true}).waitFor();
  await healthy(`${id}: lápis após hover`);
  assert.match(await page.getByRole('dialog').getByText(/Origem:/).innerText(),/Colunas:/);
  await page.getByRole('dialog').getByLabel('Nome da fonte',{exact:true}).fill('QA cancelada');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await healthy(`${id}: cancelar edição`);assert.equal(await row.locator('.cv-source-label').innerText(),label);
  await page.getByRole('button',{name:'Adicionar fonte',exact:true}).click();
  await page.getByRole('dialog',{name:'Adicionar fonte de dados',exact:true}).waitFor();
  for(const type of ['Tabela manual','Metas mensais','Relatório existente']){await page.getByRole('dialog').getByRole('tab',{name:type,exact:true}).click();await healthy(`${id}: adicionar ${type}`);}
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await row.hover();await row.getByRole('button',{name:`Ver dados de ${label}`,exact:true}).click();
  await page.getByRole('dialog',{name:`Dados da fonte ${label}`,exact:true}).waitFor();await healthy(`${id}: ver dados`);
  await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  await row.hover();await row.getByRole('button',{name:`Atualizar prévia de ${label}`,exact:true}).click();await healthy(`${id}: atualizar prévia`);
  await row.hover();await row.getByRole('button',{name:`Remover fonte ${label}`,exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await healthy(`${id}: cancelar remoção`);
  // Create and remove a local inline source to exercise confirm without Save.
  await page.getByRole('button',{name:'Adicionar fonte',exact:true}).click();
  await page.getByRole('dialog').getByRole('tab',{name:'Tabela manual',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Nome da fonte',{exact:true}).fill('QA temporária');
  await page.getByRole('button',{name:'Confirmar fonte',exact:true}).click();await healthy(`${id}: confirmar fonte local`);
  const temporary=page.locator('.cv-source-row').filter({hasText:'QA temporária'});await temporary.hover();
  await temporary.getByRole('button',{name:'Remover fonte QA temporária',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar remoção',exact:true}).click();await healthy(`${id}: confirmar remoção local`);
  assert.equal(await temporary.count(),0);
  // Add all seven block types locally, walk inspector tabs and menu actions.
  for(const type of ['Texto','Tabela','KPI','Barras','Linhas','Pizza','Imagem']){
   const add=page.locator('.cv-rail').getByRole('tab',{name:'Adicionar',exact:true});if(await add.getAttribute('aria-selected')!=='true')await add.click();
   await page.getByRole('listitem',{name:new RegExp('^Adicionar '+type+':')}).click();
   const inspector=page.locator('.cv-inspector');
   for(const tab of ['Conteúdo','Aparência','Dados']){const button=inspector.getByRole('tab',{name:tab,exact:true});if(await button.isDisabled()){assert.equal(type,'Imagem');assert.equal(tab,'Dados');assert.match(await button.getAttribute('title'),/não utilizam fonte/);}else await button.click();await healthy(`${id}: ${type}/${tab}`);}
   await inspector.getByRole('button',{name:'Ações do bloco',exact:true}).click();
   await page.getByRole('menu',{name:'Menu do bloco'}).waitFor();await healthy(`${id}: ${type}/menu`);
   await page.getByRole('menuitem',{name:'Duplicar',exact:true}).click();await healthy(`${id}: ${type}/duplicar`);
   for(const action of ['Trazer para frente','Enviar para trás']){await inspector.getByRole('button',{name:'Ações do bloco',exact:true}).click();await page.getByRole('menuitem',{name:action,exact:true}).click();await healthy(`${id}: ${type}/${action}`);}
   await inspector.getByRole('tab',{name:'Conteúdo',exact:true}).click();
   if(['Barras','Linhas','Pizza'].includes(type)){
    for(const chart of ['Barras','Linhas','Pizza']){await inspector.getByRole('radiogroup',{name:'Tipo de gráfico',exact:true}).getByRole('radio',{name:chart,exact:true}).click();await healthy(`${id}: trocar ${type} para ${chart}`);}
   }
   await inspector.getByRole('button',{name:'Ações do bloco',exact:true}).click();await page.getByRole('menuitem',{name:'Excluir',exact:true}).click();await healthy(`${id}: ${type}/excluir`);
   // Select/deselect through different existing block types without moving them.
   await page.locator('.cv-block').first().focus();await healthy(`${id}: selecionar ${type}`);assert.equal(await page.locator('.cv-block.is-selected').count(),1);
   await page.keyboard.press('Escape');await healthy(`${id}: desselecionar ${type}`);assert.equal(await page.locator('.cv-block.is-selected').count(),0);
  }
  const after=await context.request.get(canvasUrl);assert.equal(after.status(),200);assert.deepEqual(await after.json(),original,`${id}: configuração persistida deve permanecer intacta`);
  await page.screenshot({path:`/evidence/task13-report-${id}.png`,fullPage:true});
 }
 const unexpectedConsoleErrors=consoleErrors.filter(e=>!e.includes('net::ERR_BLOCKED_BY_CLIENT'));
 assert.deepEqual(unexpectedConsoleErrors,[]);
 assert.ok(blocked.every(r=>r.path.endsWith('/canvas-source-preview/')),'Nenhuma tentativa de salvar é permitida');
 console.log(JSON.stringify({reports:[6,8,9],checks,errors,consoleErrors,blocked,realWrites:0}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
