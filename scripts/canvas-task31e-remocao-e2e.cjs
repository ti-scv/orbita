// Ambiente descartável com relatórios 1 (rascunho) e 2 (ativo); nunca aponte ao banco real.
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path");
(async () => {
  const base = process.env.CANVAS_QA_URL;
  if (!base || !process.env.CANVAS_SESSION_FILE || !process.env.CANVAS_QA_ISOLATED) throw Error("Informe URL, sessão e CANVAS_QA_ISOLATED=1 para ambiente descartável.");
  const dest = process.env.CANVAS_QA_PRINTS || "/prints";
  fs.mkdirSync(dest,{recursive:true});
  const b = await chromium.launch({args:["--no-sandbox"]});
  const c = await b.newContext({viewport:{width:1440,height:900}});
  await c.addCookies([{name:"sessionid",value:fs.readFileSync(process.env.CANVAS_SESSION_FILE,"utf8").trim(),url:base}]);
  const p = await c.newPage(), result = [];
  const cdp = await c.newCDPSession(p); await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
  p.on("request", req=> { if(req.method() !== "GET") result.push({request:req.method(),url:req.url()}); });
  const blocks=()=>p.locator(".cv-block");
  const open=async id=>{await p.goto(`${base}/relatorios/${id}/canvas?unit=qa31e`); await blocks().first().waitFor();};
  const check=async (name,fn)=>{try {await fn(); result.push({name,passed:true}); await p.screenshot({path:path.join(dest,`t31e-remocao-${name}.png`)});} catch(e) {result.push({name,passed:false,error:e.message});}};
  const requireCount=async n=>{if(await blocks().count()!==n)throw Error(`Esperados ${n} blocos, recebidos ${await blocks().count()}`);};
  const undo=async()=>{await p.getByRole("button",{name:"Desfazer",exact:true}).click();await requireCount(2);};
  await open(1);
  for(const key of ["Delete","Backspace"]) await check(key,async()=>{await blocks().first().click();await p.keyboard.press(key);await requireCount(1);await p.screenshot({path:path.join(dest,`t31e-removido-${key}.png`)});await undo();});
  await check("botao",async()=>{await blocks().first().click();await p.getByRole("button",{name:"Ações do bloco"}).click();await p.getByRole("menuitem",{name:/Remover Primeiro/}).click();await requireCount(1);await undo();});
  for(const modifier of ["Shift","Control"]) await check(modifier,async()=>{await blocks().first().click();await blocks().nth(1).click({modifiers:[modifier]});await p.keyboard.press("Delete");await requireCount(0);await undo();});
  await open(2);
  await check("ativo",async()=>{await blocks().first().click();await blocks().nth(1).click({modifiers:["Shift"]});await p.keyboard.press("Delete");await p.keyboard.press("Backspace");await requireCount(2);await blocks().first().click();await p.getByRole("button",{name:"Ações do bloco"}).click();const remove=p.getByRole("menuitem",{name:/Remover Primeiro/});if(!await remove.count() || await remove.isEnabled()) throw Error("Remoção habilitada em relatório ativo");});
  await b.close();
  fs.writeFileSync(path.join(dest,"t31e-remocao-resultados.json"),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2)); if(result.some(r=>r.passed===false || r.request))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
