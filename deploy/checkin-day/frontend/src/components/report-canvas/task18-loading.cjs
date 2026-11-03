// Browser regression for the built staging app; only reads, never saves reports.
// Run in the existing Playwright QA image with a private session mount.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const base = process.env.QA_BASE || "http://127.0.0.1:8091";
    const context = await browser.newContext({
      storageState: "/private/session.json",
    });
    const page = await context.newPage();
    const writes = [],
      errors = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/") && r.method() !== "GET")
        writes.push(new URL(r.url()).pathname);
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    // Leave font CSS pending: even a provider that never answers must not
    // delay first paint, session initialization, or editing. This regression
    // uses interception; comparative timings use normal HTTP cache instead.
    let pendingFonts = 0;
    await page.route("https://fonts.googleapis.com/**", () => {
      pendingFonts++;
    });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 100,
      downloadThroughput: 250000,
      uploadThroughput: 125000,
    });
    const start = Date.now();
    await page.goto(`${base}/relatorios/326/canvas?unit=scv`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Aumentar zoom", exact: true })
      .click({ timeout: 10000 });
    const editorAndZoomMs = Date.now() - start;
    assert(
      editorAndZoomMs < 10000,
      "Editor depende da fonte externa ou excedeu 10 s",
    );
    assert(await page.locator(".cv-workspace").isVisible());
    assert(
      pendingFonts > 0,
      "A fonte não foi solicitada; cenário de timeout inválido",
    );
    const cssUrls = await page
      .locator("link[rel=stylesheet]")
      .evaluateAll((links) => links.map((l) => l.href));
    for (const url of cssUrls.filter((url) => url.startsWith(base))) {
      const css = await (await context.request.get(url)).text();
      assert(
        !/@import[^;]*fonts\.googleapis/.test(css),
        "CSS local ainda bloqueia com @import externo",
      );
    }
    for (const path of [
      "/api/v1/auth/session/",
      "/api/v1/reports/326/canvas/?unit=scv",
    ]) {
      const response = await context.request.get(base + path, {
        headers: { "Accept-Encoding": "gzip" },
      });
      assert.equal(response.status(), 200);
      assert.equal(response.headers()["content-encoding"], "gzip");
      assert(!/immutable/.test(response.headers()["cache-control"] || ""));
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        fontProviderUnavailable: "passed",
        jsonGzip: "passed",
        editorAndZoomMs,
        writes: 0,
        errors: 0,
      }),
    );
    await context.close();
    const anonymous = await browser.newContext();
    const login = await anonymous.newPage();
    await login.route("https://fonts.googleapis.com/**", (route) =>
      route.abort(),
    );
    await login.goto(base, { waitUntil: "domcontentloaded" });
    await login.locator(".lg-form").waitFor();
    assert(
      await login.locator(".lg-brand img").isVisible(),
      "Marca do login ausente",
    );
    assert(
      (await login.locator(".lg-brand img").getAttribute("src")).includes(
        "brand-wordmark.png",
      ),
    );
    console.log(
      "Login customizado preservado: formulário e marca disponíveis.",
    );
    await anonymous.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
