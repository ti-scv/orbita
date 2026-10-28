process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
// QA com sessão e respostas sintéticas; nenhuma escrita chega ao servidor.
const { chromium } = require(process.env.CANVAS_QA_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assetCache = new Map();
(async () => {
  const dest = process.env.CANVAS_QA_PRINTS || path.resolve(__dirname, '../docs/canvas-qa-prints');
  fs.mkdirSync(dest, {recursive:true}); fs.mkdirSync('/tmp/qa-prints', {recursive:true});
  const browser = await chromium.launch({args:['--no-sandbox']});
  const results = [];
  try {
    for (const id of [1,2,6]) for (const width of [1100,1280,1440]) for (const theme of ['light','dark']) {
      const context = await browser.newContext({viewport:{width,height:900}});
      const page = await context.newPage();
      let failPreview = false, validationCalls = 0;
      const columns = ["Paciente", "Status", "Data", "Unidade", "Tipo", "Responsável", "Contato", "Observação"];
      const rows = Array.from({length:50}, (_,i) => [`Paciente ${i}`, "pending", "2026-10-01T00:00:00", "AME", "Contato", "Equipe", "Telefone", "Observação"]);
      const layout = {schema_version:1,page:{width:1000,height:1250,columns:24,background:"#ffffff"},sources:[{id:"dados",type:"report",report_id:id,dataset:"dados",parameters:{start:{parameter:"start"},end:{parameter:"end"},unidade:"ame",tipo_envio:"appointment"}}],pages:[{id:"p",name:"Página 1",blocks:[{id:"b1",type:"table",source_id:"dados",title:"Acompanhamentos",x:35,y:50,width:900,height:400,options:{columns}}]}]};
      await page.addInitScript(({id, layout}) => { const draft = structuredClone(layout); draft.pages[0].name = 'Rascunho de teste'; localStorage.setItem(`orbita:canvas_draft:ame:${id}:1`, JSON.stringify({layout:draft,enabled:false,outputFormat:'pdf',timestamp:Date.now()})); }, {id, layout});
      await page.route('**/assets/**', async route => { const url=route.request().url(); if (!assetCache.has(url)) assetCache.set(url, route.fetch({timeout:90000}).then(async response => ({status:response.status(),headers:response.headers(),body:await response.body()}))); try {await route.fulfill(await assetCache.get(url));} catch (error) {assetCache.delete(url); throw error;} });
      await page.route('**/api/**', async route => {
        const req=route.request(), p=new URL(req.url()).pathname;
        if(p.endsWith('/canvas-column-origin/')) return route.fulfill({json:{source:'Acompanhamentos',column:'Paciente',database:'Relatório',query:'SELECT paciente',expression:''}});
        if(p.endsWith('/canvas-validate/')) validationCalls++;
        if(p.endsWith('/canvas-source-preview/') && failPreview) return route.fulfill({status:400,json:{detail:'Fonte "dados": contacts confirmed not-sent ame appointment start end tipo_envio › Dados',source_id:'dados',code:'raw_code'}});
        if(p.endsWith('/canvas-source-preview/')) return route.fulfill({json:{columns:columns.map(name=>({name,type:"text"})),rows,total_rows:187,truncated:true}});
        if(req.method()!=='GET') return route.abort('blockedbyclient');
        let body={};
        if(p.endsWith('/auth/csrf/')) body={csrfToken:'synthetic'};
        else if(p.endsWith('/auth/session/')) body={username:'qa',units:[{id:1,slug:'ame',name:'AME',paused:false}],roles:{ame:'admin'},mode:'simulated'};
        else if(/\/reports\/\d+\/canvas\/$/.test(p)) body={version:1,layout,enabled:false,output_format:'pdf',parameter_editor:['start','end','unidade','tipo_envio'].map(name=>({name,type:'string',uses:[],status:'Usado'})),sources:[{id,name:'Acompanhamentos e contatos',code:'qa',columns,datasets:[{id:'dados',name:'Dados',columns}]}],assets:[],monthly_goals:[]};
        else if(/\/reports\/\d+\/$/.test(p)) body={id,name:`Relatório ${id}`,version:1,parameter_schema:{start:{type:'date',required:false},end:{type:'date',required:false},unidade:{type:'string',required:false,default:id === 1 ? '' : 'ame',use_default:true},tipo_envio:{type:'string',required:false,default:'',use_default:true}}};
        return route.fulfill({json:body});
      });
      const started = Date.now();
      const record = {id,width,theme,panels:[],errors:[]};
      page.on('pageerror', error => record.errors.push(error.message));
      async function capture(panel, print = true) {
        await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 500))]));
        await page.addScriptTag({path:process.env.CANVAS_QA_AXE || '/qa/node_modules/axe-core/axe.min.js'});
        const axe = await page.evaluate(async () => {const r=await window.axe.run([...document.querySelectorAll('[role=dialog]')].at(-1) || document.querySelector('main.cv-root') || document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary,checks:n.any}))}))};});
        const metrics = await page.evaluate(() => {
          const visibleRect = el => { let r=el.getBoundingClientRect(); let rect={left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)}; for(let parent=el.parentElement;parent;parent=parent.parentElement) { const s=getComputedStyle(parent), p=parent.getBoundingClientRect(); if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) {rect.left=Math.max(rect.left,p.left);rect.right=Math.min(rect.right,p.right);} if (/(hidden|auto|scroll|clip)/.test(s.overflowY)) {rect.top=Math.max(rect.top,p.top);rect.bottom=Math.min(rect.bottom,p.bottom);} } return rect; };
          const visible = el => { const r=visibleRect(el), s=getComputedStyle(el); return r.right>r.left && r.bottom>r.top && s.visibility!=='hidden' && s.display!=='none'; };
          const buttons = [...document.querySelectorAll('button')].filter(visible).filter(el => { const r=el.getBoundingClientRect(), top=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.top+r.height/2))); return top && (el.contains(top) || top.contains(el)); });
          const unnamed = buttons.filter(b => !(b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText.trim())).map(b => b.outerHTML.slice(0,180));
          const clipped = [...document.querySelectorAll('button,label,.cv-source-label,.cv-origin-text')].filter(visible).filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'hidden').map(e => ({text:e.textContent.trim().slice(0,80), intentional:getComputedStyle(e).textOverflow === 'ellipsis' && !!e.getAttribute('title')}));
          const overlaps = [];
          for (let i=0;i<buttons.length;i++) for (let j=i+1;j<buttons.length;j++) {
            const a=visibleRect(buttons[i]), b=visibleRect(buttons[j]);
            if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2) overlaps.push([buttons[i].getAttribute('aria-label')||buttons[i].innerText,buttons[j].getAttribute('aria-label')||buttons[j].innerText]);
          }
          const raw = /(?:\b(?:contacts|not-sent|confirmed|ame|appointment|start|end|tipo_envio)\b|›\s*Dados)/;
          const leaks = [...document.querySelectorAll('main.cv-root *,[role="dialog"] *')].filter(visible).flatMap(e => {
            if(e.closest('textarea#canvas-json-text,details:not([open]) > :not(summary)')) return [];
            const values = [e.getAttribute('title'),e.getAttribute('aria-label'), ...[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent)];
            if(e.matches('input') && e.type!=='radio' && e.type!=='checkbox')values.push(e.value);
            return values.filter(v=>v&&(raw.test(v) || /^(dados|unidade)$/.test(v.trim()))).map(v=>({tag:e.tagName,value:v}));
          });
          return {horizontal:document.documentElement.scrollWidth > innerWidth, unnamed, clipped, overlaps, leaks, fonts:{status:document.fonts.status, loaded:[...document.fonts].filter(f=>f.status==="loaded").map(f=>f.family)}};
        });
        const filename = `t29d-${id}-${width}-${theme}-${panel}.png`;
        const screenshot = print && (!process.env.CANVAS_QA_CAPTURE_PANEL || process.env.CANVAS_QA_CAPTURE_PANEL === panel);
        if (screenshot) { await page.screenshot({path:path.join(dest,filename)}); fs.copyFileSync(path.join(dest,filename),path.join('/tmp/qa-prints',filename)); }
        record.panels.push({panel,screenshot,axe,...metrics}); if(metrics.leaks.length) throw new Error('Identificador cru em '+panel+': '+JSON.stringify(metrics.leaks));
      }
      try {
        await page.goto(`http://127.0.0.1:8091/relatorios/${id}/canvas?unit=ame`, {timeout:90000,waitUntil:'domcontentloaded'});
        await page.locator('.cv-workspace').waitFor({timeout:90000});
        record.open_ms = Date.now()-started;
        await page.getByRole('button',{name:'Descartar',exact:true}).click();
        record.draftDiscarded = await page.evaluate(id => localStorage.getItem(`orbita:canvas_draft:ame:${id}:1`) === null, id);
        if (!record.draftDiscarded) throw new Error('Rascunho não foi descartado');
        await page.waitForTimeout(100);
        record.marks = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('mark').filter(e => e.name.startsWith('canvas-')).map(e => [e.name, Math.round(e.startTime)])));
        record.zoom = await page.evaluate(() => { const label=document.querySelector('.cv-zoom-trigger')?.textContent; const paper=document.querySelector('.cv-page'); return {label, transform: paper && getComputedStyle(paper).transform}; });
        for(let n=0;n<3 && await page.locator('html').getAttribute('data-theme')!==theme;n++) await page.locator('.cv-theme-toggle').click();
        if (await page.locator('html').getAttribute('data-theme')!==theme) throw new Error('Tema solicitado não foi aplicado');
        await page.getByRole('button',{name:'Dados reais',exact:true}).click();
        await page.waitForTimeout(250);
        record.times24 = !(await page.locator('main.cv-root').innerText()).match(/\b(?:AM|PM)\b/i);
        await page.locator('.cv-rail').getByRole('tab',{name:'Dados',exact:true}).click();
        await page.locator('.cv-source-title-line').first().click();
        await page.locator('.cv-column-row').first().waitFor();
        record.defaultPanelWidth = await page.locator('.cv-column-row').first().evaluate(e => Math.round(e.getBoundingClientRect().width));
        if (!(await page.locator('.cv-column-row').first().innerText()).includes('Paciente')) throw new Error('Nome da coluna ausente');
        record.pageBlockTitles=await page.locator('.cv-table-col-item > button:first-child > span').evaluateAll(items=>items.map(e=>({text:e.textContent,width:e.getBoundingClientRect().width,overflow:e.scrollWidth>e.clientWidth+2})));
        if(record.pageBlockTitles.some(e=>e.width<100 || e.overflow))throw new Error('Título do bloco cortado na página: '+JSON.stringify(record.pageBlockTitles));
        await capture('dados');
        await page.locator('.cv-preview-controls summary').first().click(); await capture('filtros', false); await page.locator('.cv-preview-controls summary').first().click();
        await page.getByRole('button',{name:/Editar parâmetros/}).click(); await capture('parametros');
        await page.locator('.cv-source-row').first().getByRole('button',{name:/Ver dados de/}).click();
        await page.locator('.cv-data-drawer').waitFor(); await capture('gaveta');
        const sorter=page.locator('.cv-preview-table').getByRole('columnheader',{name:/Paciente/i});
        await sorter.press('Enter'); if(await sorter.getAttribute('aria-sort')!=='ascending')throw new Error('Ordenação por Enter falhou');
        await sorter.press('Space'); if(await sorter.getAttribute('aria-sort')!=='descending')throw new Error('Ordenação por Espaço falhou');
        await page.locator('.cv-column-origins summary').click();
        await page.locator('.cv-data-drawer').getByRole('button',{name:/Origem da coluna/}).first().click();
        await page.getByRole('dialog',{name:/Origem da coluna/}).waitFor(); await capture('origem');
        await page.getByRole('dialog',{name:/Origem da coluna/}).getByRole('button',{name:'Fechar janela',exact:true}).click();
        await page.locator('.cv-data-drawer').getByRole('button',{name:'Fechar',exact:true}).click();
        await page.locator('.cv-source-row').first().getByRole('button',{name:/Editar fonte/}).click(); await capture('fonte');
        await page.getByRole('dialog').last().getByRole('button',{name:'Fechar janela',exact:true}).click();
        if (await page.getByRole('button',{name:'Testar relatório',exact:true}).count()) await page.getByRole('button',{name:'Testar relatório',exact:true}).first().click();
        else { await page.getByRole('button',{name:'Mais ações',exact:true}).click(); await page.getByRole('menuitem',{name:'Testar relatório'}).click(); }
        await page.getByRole('dialog',{name:'Testar relatório'}).waitFor();
        if (id === 1 && await page.getByRole('dialog',{name:'Testar relatório'}).getByLabel(/Unidade/).inputValue() !== '') throw new Error('Unidade opcional vazia recebeu um valor indevido');
        await capture('dialogo-parametros');
        await page.getByRole('dialog',{name:'Testar relatório'}).getByRole('button',{name:'Fechar janela',exact:true}).click();
        await page.locator('[data-block-id]').first().click({force:true,position:{x:350,y:80}});
        await page.getByRole('tab',{name:'Dados',exact:true}).last().click(); await capture('inspetor-dados',false);
        await page.getByRole('tab',{name:'Conteúdo',exact:true}).click(); await capture('inspetor-conteudo',false);
        record.columnNames = await page.locator('.cv-table-col-name').evaluateAll(items=>items.map(e=>({name:e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,overflow:e.scrollWidth>e.clientWidth+2})));
        if(record.columnNames.some(e=>e.width<20 || e.height<14 || e.overflow))throw new Error('Nome da coluna escondido ou cortado: '+JSON.stringify(record.columnNames));
        await page.locator('.cv-rail').getByRole('tab',{name:'Estrutura',exact:true}).click(); await capture('estrutura',false);
        await page.locator('.cv-rail').getByRole('tab',{name:'Dados',exact:true}).click();
        failPreview = true;
        await page.locator('.cv-source-row').first().getByRole('button',{name:/Atualizar prévia de/}).click();
        await page.locator('.cv-source-row').first().locator('.cv-chip.error').waitFor();
        await capture('erro-backend',false);
        await page.getByRole('button',{name:'JSON',exact:true}).click();
        await page.getByRole('textbox',{name:'JSON do canvas'}).fill('{');
        await page.getByRole('button',{name:'Validar e aplicar',exact:true}).click();
        await page.getByRole('alert').filter({hasText:'JSON inválido'}).waitFor();
        if(validationCalls) throw new Error('Validação inválida chegou à rede');
        await capture('json-invalido',false);
      } catch (error) { record.errors.push(error.message); }
      results.push(record); await context.close();
      fs.writeFileSync(path.join(dest,'t29d-resultados.json'),JSON.stringify(results,null,2));
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify(results,null,2));
  if (results.length !== 18 || results.some(r => r.errors.length || r.panels.length !== 12 || r.panels.some(p => p.leaks?.length || p.axe?.violations?.length))) process.exitCode=1;
})().catch(error => { console.error(error.message); process.exitCode=1; });
