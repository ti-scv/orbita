const {chromium} = require("playwright"), fs = require("fs");
(async () => {
  const base = "http://127.0.0.1:8095";
  const browser = await chromium.launch({args:["--no-sandbox"]});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:"sessionid",value:fs.readFileSync("/qa/session","utf8").trim(),url:base}]);
  const page = await context.newPage();
  await page.goto(`${base}/relatorios?unit=qa33c&reportTab=appSources`);
  await page.waitForURL(/\/configuracoes\?/);
  await page.getByText("Instâncias dos apps", {exact:true}).first().waitFor();
  if (await page.getByRole("tab", {name:/Instâncias do app/}).count()) throw Error("A aba antiga ainda aparece");
  await page.goto(`${base}/relatorios/1/canvas?unit=qa33c`);
  await page.locator(".cv-workspace").waitFor();
  if (await page.getByText(/Instâncias dos? apps?/i).count()) throw Error("Atalho antigo ainda aparece no editor");
  console.log("Atalho antigo redireciona para Configurações gerais; atalho ausente no editor.");
  await browser.close();
})().catch(error => {console.error(error); process.exit(1)});
