// QA com sessão e respostas sintéticas; nenhuma escrita chega ao servidor.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const dest = process.env.CANVAS_QA_PRINTS || '/opt/orbita/docs/canvas-qa-prints';
  fs.mkdirSync(dest, {recursive:true}); fs.mkdirSync('/tmp/qa-prints', {recursive:true});
  const browser = await chromium.launch({args:['--no-sandbox']});
  const results = [];
  try {
    for (const id of [6]) for (const zoom of [0.8,1,1.25,1.5]) for (const theme of ['light','dark']) {
      const width = 1440;
      const context = await browser.newContext({viewport:{width,height:900}});
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page); await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", {cacheDisabled:true});
      const columns = ["Paciente", "Status", "Data", "Unidade", "Tipo", "Responsável", "Contato", "Observação"];
      const rows = Array.from({length:50}, (_,i) => [`Paciente ${i}`, "pending", "2026-10-01T00:00:00", "AME", "Contato", "Equipe", "Telefone", "Observação"]);
      const layout = {schema_version:1,page:{width:1000,height:1250,columns:24,background:"#ffffff"},sources:[{id:"dados",type:"report",report_id:id,dataset:"dados",parameters:{start:{parameter:"start"},end:{parameter:"end"},unidade:{parameter:"unidade"},tipo_envio:{parameter:"tipo_envio"}}}],pages:[{id:"p",name:"Página 1",blocks:[{id:"b1",type:"table",source_id:"dados",title:"Acompanhamentos",x:35,y:50,width:900,height:400,options:{columns}}]}]};
      await page.addInitScript(({id, layout}) => { const draft = structuredClone(layout); draft.pages[0].name = 'Rascunho de teste'; localStorage.setItem(`orbita:canvas_draft:ame:${id}:1`, JSON.stringify({layout:draft,enabled:false,outputFormat:'pdf',timestamp:Date.now()})); }, {id, layout});
      await page.route('**/api/**', async route => {
        const req=route.request(), p=new URL(req.url()).pathname;
        if (!p.startsWith('/api/')) return route.continue();
        if(p.endsWith('/canvas-source-preview/')) return route.fulfill({json:{columns:columns.map(name=>({name,type:"text"})),rows,total_rows:187,truncated:true}});
        if(req.method()!=='GET') return route.abort('blockedbyclient');
        let body={};
        if(p.endsWith('/auth/csrf/')) body={csrfToken:'synthetic'};
        else if(p.endsWith('/auth/session/')) body={username:'qa',units:[{id:1,slug:'ame',name:'AME',paused:false}],roles:{ame:'admin'},mode:'simulated'};
        else if(/\/reports\/\d+\/canvas\/$/.test(p)) body={version:1,layout,enabled:!!process.env.CANVAS_QA_READONLY,output_format:'pdf',parameter_editor:['start','end','unidade','tipo_envio'].map(name=>({name,type:'string',uses:[],status:'Usado'})),sources:[{id,name:'Acompanhamentos e contatos',code:'qa',columns,datasets:[{id:'dados',name:'Dados'}]}],assets:[],monthly_goals:[]};
        else if(/\/reports\/\d+\/$/.test(p)) body={id,name:`Relatório ${id}`,version:1,parameter_schema:{start:{type:'date',required:false},end:{type:'date',required:false},unidade:{type:'string',required:false,default:'ame',use_default:true},tipo_envio:{type:'string',required:false,default:'',use_default:true}}};
        return route.fulfill({json:body});
      });
      const started = Date.now();
      const record = {id,width,browserZoom:zoom,theme,panels:[],errors:[]};
      page.on('pageerror', error => record.errors.push(error.message));
      async function capture(panel) {
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
          return {horizontal:document.documentElement.scrollWidth > innerWidth, unnamed, clipped, overlaps};
        });
        const filename = `t31-editor-${id}-${zoom}-${theme}-${panel}.png`;
        await page.screenshot({path:path.join(dest,filename)}); fs.copyFileSync(path.join(dest,filename),path.join('/tmp/qa-prints',filename));
        record.panels.push({panel,...metrics});
      }
      try {
        await page.goto(`http://127.0.0.1:8093/relatorios/${id}/canvas?unit=ame`);
        await page.locator('.cv-workspace').waitFor({timeout:90000});
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);
        record.open_ms = Date.now()-started;
        await page.getByRole('button',{name:'Descartar',exact:true}).click();
        record.draftDiscarded = await page.evaluate(id => localStorage.getItem(`orbita:canvas_draft:ame:${id}:1`) === null, id);
        if (!record.draftDiscarded) throw new Error('Rascunho não foi descartado');
        await page.waitForTimeout(100);
        record.marks = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('mark').filter(e => e.name.startsWith('canvas-')).map(e => [e.name, Math.round(e.startTime)])));
        record.zoom = await page.evaluate(() => { const label=document.querySelector('.cv-zoom-trigger')?.textContent; const paper=document.querySelector('.cv-page'); return {label, transform: paper && getComputedStyle(paper).transform}; });
        for(let n=0;n<3 && await page.locator('html').getAttribute('data-theme')!==theme;n++) await page.locator('.cv-theme-toggle').click();
        if (await page.locator('html').getAttribute('data-theme')!==theme) throw new Error('Tema solicitado não foi aplicado');
        await capture('editor');
        await page.getByRole('button',{name:'Testar relatório',exact:true}).click();
        await page.getByRole('dialog',{name:'Testar relatório'}).waitFor();
        await capture('testar');
        await page.getByRole('button',{name:'Fechar',exact:true}).click();
        const block = page.locator('.cv-block').first();
        await block.click({button:'right'});
        await page.getByRole('menuitem',{name:/Remover Acompanhamentos/}).waitFor();
        await capture('menu');
        await page.getByRole('menuitem',{name:/Remover Acompanhamentos/}).click();
        await page.getByRole('button',{name:'Desfazer',exact:true}).waitFor();
        await capture('desfazer');
        await page.getByRole('button',{name:'Desfazer',exact:true}).click();
        if (await page.locator('.cv-block').count() !== 1) throw new Error('Desfazer não restaurou o componente');
      } catch (error) { record.errors.push(error.message); }
      results.push(record); await context.close();
      fs.writeFileSync(path.join(dest,'t31-editor-resultados.json'),JSON.stringify(results,null,2));
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify(results,null,2));
  if (results.some(r => r.errors.length)) process.exitCode=1;
})().catch(error => { console.error(error.message); process.exitCode=1; });
