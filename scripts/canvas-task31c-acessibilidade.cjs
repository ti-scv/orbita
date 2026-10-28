// Leitura no staging: informe CANVAS_SESSION_FILE com uma sessão já existente.
// A prévia não é chamada e nenhuma ação de gravação é executada.
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("node:fs");
(async () => {
  const base = process.env.CANVAS_QA_URL || "http://127.0.0.1:8091";
  const session = fs.readFileSync(process.env.CANVAS_SESSION_FILE, "utf8").trim();
  const browser = await chromium.launch({args:["--no-sandbox"]});
  const results = [];
  try {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({viewport:{width:1440,height:900}, colorScheme:theme});
      await context.addCookies([{name:"sessionid",value:session,url:base}]);
      await context.addInitScript(t => localStorage.setItem("orbita-theme", t), theme);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", {cacheDisabled:true});
      await page.route("**/api/**", route => route.request().method() === "GET" ? route.continue() : route.abort());
      const audit = async screen => {
        const report = await new AxeBuilder({page}).analyze();
        results.push({theme,screen,violations:report.violations.map(v => ({id:v.id,impact:v.impact,count:v.nodes.length}))});
      };
      await page.goto(`${base}/relatorios?unit=ame`);
      await page.getByRole("button",{name:/Remover relatório/}).first().waitFor();
      await audit("relatorios");
      await page.getByRole("button",{name:/Remover relatório/}).first().click();
      await page.getByRole("dialog").waitFor(); await audit("remover-relatorio");
      await page.keyboard.press("Escape");
      results.push({theme,screen:"esc-relatorio",passed:await page.getByRole("dialog").count() === 0});
      if (await page.getByRole("dialog").count()) await page.getByRole("button",{name:"Cancelar",exact:true}).click();
      await page.getByRole("tab",{name:"Conexões",exact:true}).click();
      await page.getByRole("button",{name:/Remover conexão/}).first().waitFor(); await audit("conexoes");
      await page.getByRole("button",{name:/Remover conexão/}).first().click();
      await page.getByRole("dialog").waitFor(); await audit("remover-conexao");
      await page.goto(`${base}/relatorios/1/canvas?unit=ame`);
      await page.locator(".cv-workspace").waitFor(); await audit("editor");
      await page.getByRole("button",{name:"Testar relatório",exact:true}).click();
      await page.getByRole("dialog",{name:"Testar relatório"}).waitFor(); await audit("testar");
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify(results,null,2));
  if (results.some(r => r.passed === false || r.violations?.length)) process.exitCode = 1;
})().catch(e => {console.error(e);process.exitCode=1});
