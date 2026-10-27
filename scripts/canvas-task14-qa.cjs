// Read-only staging QA at 1100px. Session stays in a private external mount.
// Only source-preview POSTs (read-only queries) are allowed; saves are blocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const base = process.env.QA_BASE || 'http://127.0.0.1:8091';
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  const performanceRuns = [];
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({storageState: '/private/session.json', viewport: {width: 1100, height: 900}});
    const page = await context.newPage(), api = [], blocked = [];
    await page.route('**/api/**', route => {
      if (route.request().method() !== 'GET') { blocked.push(new URL(route.request().url()).pathname); return route.abort(); }
      return route.continue();
    });
    page.on('response', response => {
      const request = response.request(), url = new URL(response.url());
      if (url.pathname.startsWith('/api/')) api.push({path: url.pathname, status: response.status(), ms: Math.round(Date.now() - request.timing().startTime)});
    });
    const start = Date.now();
    await page.goto(base + '/relatorios?unit=ame');
    await page.locator('.report-table tbody tr').first().waitFor({timeout: 60000});
    const readyMs = Date.now() - start;
    await page.waitForTimeout(300);
    assert.ok(!(await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name))).some(url => /\/charts-[^/]+\.js/.test(url)), 'a lista não deve baixar a biblioteca de gráficos');
    performanceRuns.push({run, browserCache: 'empty context', readyMs, api, assets: await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.js$/.test(new URL(r.name).pathname)).map(r => ({path: new URL(r.name).pathname, bytes: r.encodedBodySize, ms: Math.round(r.duration)})))});
    assert.deepEqual(blocked, []);
    assert.ok(!api.some(r => /\/(appointments|indicators|messages|replies|issues|rules|templates|imports|audit|control)\//.test(r.path)));
    await context.close();
  }
  fs.writeFileSync('/evidence/performance.json', JSON.stringify(performanceRuns, null, 2));
  if (process.env.PERFORMANCE_ONLY === '1') { console.log(JSON.stringify({performanceRuns})); await browser.close(); return; }

  const context = await browser.newContext({storageState: '/private/session.json', viewport: {width: 1100, height: 900}});
  const page = await context.newPage(), errors = [], blocked = [], checks = [], styles = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  let delayed = false;
  await page.route('**/api/**', async route => {
    const r = route.request(), path = new URL(r.url()).pathname;
    if (r.method() === 'GET') return route.continue();
    if (r.method() === 'POST' && path.endsWith('/canvas-source-preview/')) {
      if (delayed) await new Promise(resolve => setTimeout(resolve, 1200));
      return route.continue();
    }
    blocked.push({method: r.method(), path}); return route.abort();
  });
  async function screenshot(name) { await page.screenshot({path: '/evidence/' + name + '.png', fullPage: true}); }
  async function setTheme(theme) {
    const toggle = page.locator('.cv-theme-toggle');
    assert.equal(await toggle.count(), 1, 'um único botão de tema');
    for (let i = 0; i < 3; i++) {
      if ((await toggle.getAttribute('aria-label')).includes(theme === 'dark' ? 'Tema: Escuro.' : 'Tema: Claro.')) break;
      await toggle.click();
    }
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
  }
  for (const id of [6, 8, 9]) {
    const configUrl = base + '/api/v1/reports/' + id + '/canvas/?unit=ame';
    const before = await context.request.get(configUrl);
    assert.equal(before.status(), 200);
    const original = await before.json();
    await page.goto(base + '/relatorios/' + id + '/canvas?unit=ame');
    await page.locator('.cv-block').first().waitFor({timeout: 60000});
    assert.equal(await page.getByRole('button', {name: 'Dados reais', exact: true}).count(), 1);
    assert.equal(await page.getByRole('button', {name: 'Dados de exemplo', exact: true}).count(), 1);
    await page.getByRole('button', {name: 'Dados reais', exact: true}).click();
    await page.locator('.cv-preview-controls').first().waitFor({timeout: 60000});
    await page.locator('.cv-rail').getByRole('tab', {name: 'Dados', exact: true}).click();
    const row = page.locator('.cv-source-row').first(), label = await row.locator('.cv-source-label').innerText();
    for (const theme of ['light', 'dark']) {
      await setTheme(theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const values = await page.evaluate(() => {
        const selectors = ['.cv-preview-controls summary', '.cv-origin-chip'];
        return selectors.map(selector => {
          const c = getComputedStyle(document.querySelector(selector));
          return {selector, background: c.backgroundColor, color: c.color, token: c.getPropertyValue('--cv-surface-3').trim()};
        });
      });
      if (theme === 'dark') for (const value of values) assert.equal(value.background, 'rgb(28, 33, 40)');
      styles.push({id, theme, values});
      await screenshot('report-' + id + '-' + theme + '-canvas');
      await page.getByRole('button', {name: 'Mais ações', exact: true}).click();
      const test = page.getByRole('menuitem', {name: 'Testar relatório', exact: true});
      assert.match(await test.getAttribute('title'), /teste/);
      await test.click();
      await page.getByRole('dialog', {name: 'Testar relatório', exact: true}).waitFor();
      await screenshot('report-' + id + '-' + theme + '-testar');
      await page.getByRole('dialog').getByRole('button', {name: 'Fechar', exact: true}).click();
      await row.hover();
      await row.getByRole('button', {name: 'Editar fonte ' + label, exact: true}).click();
      const dialog = page.getByRole('dialog', {name: 'Editar fonte de dados', exact: true});
      await dialog.waitFor();
      assert.equal(await dialog.getByLabel('Nome da fonte', {exact: true}).inputValue(), label);
      await screenshot('report-' + id + '-' + theme + '-fonte');
      await dialog.getByRole('button', {name: 'Cancelar', exact: true}).click();
      await row.hover();
      delayed = true;
      await row.getByRole('button', {name: 'Ver dados de ' + label, exact: true}).click();
      const drawer = page.getByRole('dialog', {name: 'Dados da fonte ' + label, exact: true});
      await drawer.waitFor();
      if (await drawer.getByText('Atualizando…', {exact: true}).count()) {
        assert.equal(await drawer.getByText('Nenhuma coluna encontrada', {exact: true}).count(), 0);
        assert.equal(await drawer.getByText('Nenhuma linha retornada', {exact: true}).count(), 0);
        assert.equal(await drawer.getByRole('status').innerText(), 'Carregando dados…');
      }
      await drawer.locator('[aria-busy="false"]').waitFor({timeout: 60000});
      delayed = false;
      const geometry = await drawer.evaluate(e => {
        const r = e.getBoundingClientRect(), title = e.querySelector('h3'), tr = title.getBoundingClientRect();
        const first = e.querySelector('tbody td'), fr = first?.getBoundingClientRect();
        return {x: r.x, width: r.width, titleVisible: e.contains(document.elementFromPoint(tr.x + 2, tr.y + 2)), tableVisible: !fr || e.contains(document.elementFromPoint(fr.x + 2, fr.y + 2)), portal: e.parentElement === document.body};
      });
      assert.equal(geometry.portal, true); assert.equal(geometry.titleVisible, true); assert.equal(geometry.tableVisible, true);
      assert.equal(geometry.x, 0); assert.equal(geometry.width, 1100);
      const text = await drawer.innerText();
      assert.ok(!/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/.test(text), 'sem segundos nas datas');
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(text), 'sem datas ISO cruas');
      await screenshot('report-' + id + '-' + theme + '-dados');
      await drawer.getByRole('button', {name: 'Fechar', exact: true}).click();
      checks.push({id, theme, geometry, sourceName: 'matches list', loading: 'no premature empty state'});
    }
    const after = await context.request.get(configUrl);
    assert.equal(after.status(), 200); assert.deepEqual(await after.json(), original, 'configuração persistida intacta');
  }
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
  const summary = {viewport: {width: 1100, height: 900}, reports: [6, 8, 9], themes: ['light', 'dark'], checks, styles, errors, blocked, realWrites: 0};
  fs.writeFileSync('/evidence/summary.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  await browser.close();
})().catch(error => {console.error(error); process.exit(1);});
