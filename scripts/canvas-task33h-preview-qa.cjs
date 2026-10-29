const {chromium}=require("playwright"), fs=require("fs");
(async()=>{
 const id="7", session=fs.readFileSync("/qa/session","utf8").trim(), base="http://127.0.0.1:8095", browser=await chromium.launch({args:["--no-sandbox"]}), results=[];
 for(const theme of ["light"]) for(const zoom of [1]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:"sessionid",value:session,url:base}]); const p=await context.newPage(); await p.addInitScript(z => { document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.zoom = String(z); }); }, zoom); const record={theme,zoom};
  try {
   await p.goto(`${base}/relatorios/${id}/canvas?unit=qa33c`); await p.locator(".cv-workspace").waitFor({timeout:60000});
   for(let i=0;i<3 && await p.locator("html").getAttribute("data-theme")!==theme;i++) await p.locator(".cv-theme-toggle").click();
   if(await p.locator("html").getAttribute("data-theme")!==theme) throw Error("Tema não aplicado: "+theme);
   await p.locator(".cv-rail").getByRole("tab",{name:"Estrutura"}).click();
   await p.getByRole("button",{name:"Configurar formato da página"}).click();
   const dialog=p.getByRole("dialog",{name:"Formato da página"}), select=dialog.getByLabel("Orientação da página");
   await select.selectOption("landscape"); await dialog.getByRole("button",{name:"Aplicar"}).click();
   await p.waitForFunction(()=>{const e=document.querySelector(".cv-page");return e && e.style.width==="1123px" && e.style.height==="794px"});
   const preview = async (orientation) => {
    const more = p.getByRole("button",{name:"Mais ações",exact:true});
    if(await more.isVisible()) { await more.click(); await p.getByRole("menuitem",{name:"Testar relatório",exact:true}).click(); }
    else await p.getByRole("button",{name:"Testar relatório",exact:true}).click();
    const response=p.waitForResponse(r=>r.url().includes("/canvas-preview/") && r.request().method()==="POST");
    await p.getByRole("button",{name:"Gerar prévia",exact:true}).click();
    const res=await response, json=await res.json();
    if(!res.ok() || !json.content) throw Error("Prévia falhou: "+JSON.stringify(json));
    fs.writeFileSync(`/qa/prints/33h-preview-${orientation}.pdf`, Buffer.from(json.content,"base64"));
    await p.locator("iframe").waitFor();
    await p.screenshot({path:`/qa/prints/33h-preview-${orientation}.png`});
    await p.getByRole("button",{name:"Fechar",exact:true}).click();
   };
   await p.screenshot({path:`/qa/prints/33h-landscape-${theme}-${zoom===1?100:150}.png`});
   await preview("landscape");
   await p.getByRole("button",{name:"Configurar formato da página"}).click();
   await select.selectOption("portrait"); await dialog.getByRole("button",{name:"Aplicar"}).click();
   await p.waitForFunction(()=>{const e=document.querySelector(".cv-page");return e && e.style.width==="794px" && e.style.height==="1123px"});
   await p.screenshot({path:`/qa/prints/33h-portrait-${theme}-${zoom===1?100:150}.png`});
   await preview("portrait");
   record.ok=true;
  }catch(e){record.error=e.message} results.push(record); await context.close();
 }
 console.log(JSON.stringify(results,null,2)); await browser.close(); if(results.some(r=>!r.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
