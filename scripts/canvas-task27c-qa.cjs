// QA somente leitura: forneça CANVAS_QA_SESSION com um storageState Playwright válido.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const session = process.env.CANVAS_QA_SESSION;
  if (!session || !fs.existsSync(session)) throw new Error('CANVAS_QA_SESSION deve apontar para uma sessão de QA válida');
  const dest = process.env.CANVAS_QA_PRINTS || '/opt/orbita/docs/canvas-qa-prints';
  fs.mkdirSync(dest, {recursive:true}); fs.mkdirSync('/tmp/qa-prints', {recursive:true});
  const browser = await chromium.launch({args:['--no-sandbox']});
  const results = [];
  try {
    for (const id of [6, 1]) for (const width of [1440,1280,1100]) for (const theme of ['light','dark']) {
      const context = await browser.newContext({storageState:session, viewport:{width,height:900}});
      const page = await context.newPage();
      await page.route('**/api/**', route => {
        const req = route.request();
        if (req.method() === 'GET' || (req.method() === 'POST' && req.url().includes('/canvas-source-preview/'))) return route.continue();
        return route.abort();
      });
      const started = Date.now();
      const record = {id,width,theme,panels:[],errors:[]};
      page.on('pageerror', error => record.errors.push(error.message));
      async function capture(panel) {
        const metrics = await page.evaluate(() => {
          const visible = el => { const r=el.getBoundingClientRect(), s=getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; };
          const buttons = [...document.querySelectorAll('button')].filter(visible);
          const unnamed = buttons.filter(b => !(b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText.trim())).map(b => b.outerHTML.slice(0,180));
          const clipped = [...document.querySelectorAll('button,label,.cv-source-label,.cv-origin-text')].filter(visible).filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'hidden').map(e => e.textContent.trim().slice(0,80));
          const overlaps = [];
          for (let i=0;i<buttons.length;i++) for (let j=i+1;j<buttons.length;j++) {
            const a=buttons[i].getBoundingClientRect(), b=buttons[j].getBoundingClientRect();
            if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2) overlaps.push([buttons[i].getAttribute('aria-label')||buttons[i].innerText,buttons[j].getAttribute('aria-label')||buttons[j].innerText]);
          }
          return {horizontal:document.documentElement.scrollWidth > innerWidth, unnamed, clipped, overlaps};
        });
        const filename = `${id}-${width}-${theme}-${panel}.png`;
        await page.screenshot({path:path.join(dest,filename)}); fs.copyFileSync(path.join(dest,filename),path.join('/tmp/qa-prints',filename));
        record.panels.push({panel,...metrics});
      }
      try {
        await page.goto(`http://127.0.0.1:8091/relatorios/${id}/canvas?unit=ame`);
        await page.locator('.cv-workspace').waitFor({timeout:90000});
        record.open_ms = Date.now()-started;
        for(let n=0;n<3 && await page.locator('html').getAttribute('data-theme')!==theme;n++) await page.locator('.cv-theme-toggle').click();
        if (await page.locator('html').getAttribute('data-theme')!==theme) throw new Error('Tema solicitado não foi aplicado');
        await page.locator('.cv-rail').getByRole('tab',{name:'Dados',exact:true}).click(); await capture('dados');
        await page.getByRole('button',{name:/Editar parâmetros/}).click(); await capture('parametros');
        await page.locator('.cv-source-row').first().getByRole('button',{name:/Ver dados de/}).click();
        await page.locator('.cv-data-drawer').waitFor(); await capture('gaveta');
        await page.locator('.cv-data-drawer').getByRole('button',{name:'Fechar',exact:true}).click();
        await page.locator('.cv-source-row').first().getByRole('button',{name:/Editar fonte/}).click(); await capture('fonte');
      } catch (error) { record.errors.push(error.message); }
      results.push(record); await context.close();
      fs.writeFileSync(path.join(dest,'resultados.json'),JSON.stringify(results,null,2));
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify(results,null,2));
  if (results.some(r => r.errors.length)) process.exitCode=1;
})().catch(error => { console.error(error.message); process.exitCode=1; });
