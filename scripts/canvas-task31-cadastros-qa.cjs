// Matriz de cadastro: todas as respostas e ações são sintéticas.
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path");
(async () => {
  const dest = process.env.CANVAS_QA_PRINTS || "/prints";
  fs.mkdirSync(dest, {recursive:true});
  const browser = await chromium.launch({args:["--no-sandbox"]});
  const results = [];
  for (const zoom of [0.8,1,1.25,1.5]) for (const theme of ["light","dark"]) {
    const width = 1440;
    const context = await browser.newContext({viewport:{width,height:900}});
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", {cacheDisabled:true});
    await page.addInitScript(value => localStorage.setItem("orbita-theme", value), theme);
    const report = {id:999,name:"Relatório de exemplo",code:"qa",catalog_kind:"report",source:"local",enabled:true,reviewed:true,manual_enabled:true,output_format:"pdf",version:1,parameter_schema:{},components:[],keywords:[]};
    const conn = {id:123,name:"Banco de exemplo",engine:"postgres",host:"exemplo",enabled:true,validated:true,version:1};
    let removed = false;
    await page.route("**/api/**", async route => {
      const req=route.request(), u=new URL(req.url()), p=u.pathname;
      if (!p.startsWith("/api/")) return route.continue();
      let body={results:[],count:0,next:null};
      if (p.endsWith("/auth/csrf/")) body={csrfToken:"synthetic"};
      else if (p.endsWith("/auth/session/")) body={username:"qa",units:[{id:1,slug:"qa",name:"QA",paused:false}],roles:{qa:"admin"},mode:"simulated"};
      else if (p.endsWith("/reports/inventory/")) body={components:0};
      else if (p.endsWith("/reports/999/dependencias/")) body={dependencias:[]};
      else if (p.endsWith("/report-connections/123/dependencias/")) body={dependencias:["Relatório: Relatório de exemplo","Fonte: Indicadores"]};
      else if (p.endsWith("/reports/999/remover/")) {removed=true;body={name:report.name,version:2};}
      else if (p.endsWith("/reports/999/restaurar/")) {removed=false;body={name:report.name,version:3};}
      else if (p.endsWith("/reports/")) {const rows=u.searchParams.get("removidos")==="1"?(removed?[{...report,version:2}]:[]):(removed?[]:[report]);body={results:rows,count:rows.length,next:null};}
      else if (p.endsWith("/report-connections/")) {const rows=u.searchParams.get("removidos")==="1"?[{...conn, name:"Conexão removida",version:2}]:[conn];body={results:rows,count:rows.length,next:null};}
      else if (p.endsWith("/report-recipients/users/")) body=[];
      return route.fulfill({json:body});
    });
    const item={width,zoom,theme,errors:[], timings:{}}; page.on("pageerror",e=>item.errors.push(e.message));
    const snap = async name => page.screenshot({path:path.join(dest,`t31-cadastros-${zoom}-${theme}-${name}.png`)});
    try {
      const started = Date.now();
      await page.goto(`${process.env.CANVAS_QA_URL || "http://127.0.0.1:8093"}/relatorios?unit=qa`);
      await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, zoom);
      await page.getByRole("button",{name:"Remover relatório Relatório de exemplo"}).waitFor();
      item.timings.relatorios = Date.now() - started;
      await page.getByRole("button",{name:"Remover relatório Relatório de exemplo"}).click({timeout:60000});
      await page.getByText(/Ele deixará de aparecer/).waitFor();
      await snap("relatorio-confirmacao");
      await page.getByRole("button",{name:"Remover",exact:true}).click();
      await page.getByText("Relatórios removidos",{exact:true}).click();
      await page.getByText("Relatório de exemplo",{exact:true}).waitFor();
      await snap("relatorios-removidos");
      await page.getByRole("button",{name:"Restaurar relatório Relatório de exemplo",exact:true}).click();
      await page.getByRole("tab",{name:"Conexões",exact:true}).click();
      await page.getByRole("button",{name:"Remover conexão Banco de exemplo"}).click();
      await page.getByText("Fonte: Indicadores").waitFor();
      await snap("conexao-dependencias");
      await page.getByRole("button",{name:"Cancelar",exact:true}).click();
      await page.getByText("Conexões removidas",{exact:true}).click();
      await page.getByText("Conexão removida",{exact:true}).waitFor();
      await snap("conexoes-removidas");
      item.horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    } catch(e) {item.errors.push(e.message);}
    results.push(item); await context.close();
    fs.writeFileSync(path.join(dest,"t31-cadastros-resultados.json"),JSON.stringify(results,null,2));
  }
  await browser.close();
  if (results.some(r=>r.errors.length || r.horizontal)) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

