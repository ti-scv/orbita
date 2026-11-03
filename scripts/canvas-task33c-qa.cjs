const {chromium}=require("playwright"), fs=require("fs");
(async()=>{
 const [id,session]=fs.readFileSync("/qa/session","utf8").match(/QA33C (\d+) (\S+)/).slice(1), base="http://127.0.0.1:8095", browser=await chromium.launch({args:["--no-sandbox"]}), results=[];
 for(const theme of ["light","dark"]) for(const zoom of [1,1.5]){
  const context=await browser.newContext({viewport:{width:Math.round(1440/zoom),height:Math.round(1000/zoom)},deviceScaleFactor:zoom});
  await context.addCookies([{name:"sessionid",value:session,url:base}]); const p=await context.newPage(); const record={theme,zoom};
  try {
   await p.goto(`${base}/relatorios/${id}/canvas?unit=qa33c`); await p.locator(".cv-workspace").waitFor({timeout:60000});
   for(let i=0;i<3 && await p.locator("html").getAttribute("data-theme")!==theme;i++) await p.locator(".cv-theme-toggle").click();
   await p.locator(".cv-rail").getByRole("tab",{name:"Estrutura"}).click();
   await p.getByRole("button",{name:"Configurar formato da página"}).click();
   const dialog=p.getByRole("dialog",{name:"Formato da página"}), select=dialog.getByLabel("Orientação da página");
   await select.selectOption("landscape"); await dialog.getByRole("button",{name:"Aplicar"}).click();
   await p.waitForFunction(()=>{const e=document.querySelector(".cv-page");return e && e.style.width==="1123px" && e.style.height==="794px"});
   if(theme === "light" && zoom === 1) {
    await p.getByRole("button",{name:/Salvar alterações não salvas/}).click();
    await p.getByRole("button",{name:"Salvar (Ctrl+S)"}).waitFor();
    await p.reload(); await p.locator(".cv-workspace").waitFor();
    await p.waitForFunction(()=>document.querySelector(".cv-page")?.style.width === "1123px");
    await p.locator(".cv-rail").getByRole("tab",{name:"Estrutura"}).click();
   }
   await p.getByRole("button",{name:"Configurar formato da página"}).click();
   await p.screenshot({path:`/qa/prints/${theme}-${zoom===1?100:150}.png`});
   await select.selectOption("portrait"); await dialog.getByRole("button",{name:"Aplicar"}).click();
   await p.waitForFunction(()=>{const e=document.querySelector(".cv-page");return e && e.style.width==="794px" && e.style.height==="1123px"});
   if(theme === "light" && zoom === 1) {
    await p.getByRole("button",{name:/Salvar alterações não salvas/}).click();
    await p.getByRole("button",{name:"Salvar (Ctrl+S)"}).waitFor();
    await p.reload(); await p.locator(".cv-workspace").waitFor();
    await p.waitForFunction(()=>document.querySelector(".cv-page")?.style.width === "794px");
   }
   record.ok=true;
  }catch(e){record.error=e.message} results.push(record); await context.close();
 }
 console.log(JSON.stringify(results,null,2)); await browser.close(); if(results.some(r=>!r.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
