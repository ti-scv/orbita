// scripts/icones-qa.cjs — QA visual completo com matriz de prints em claro e escuro.
// Roda no container orbita-t31b-qa (Playwright + Chromium) conectado à porta 8094.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.ORBITA_PORT || 8094;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PRINTS_DIR = process.env.ORBITA_PRINTS || '/opt/orbita-icones/docs/icones-qa-prints';

fs.mkdirSync(PRINTS_DIR, { recursive: true });

function md5(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buf).digest('hex');
}

const sampleAppointments = [
  {
    id: 1,
    patient: "Maria Silva (Confirmada)",
    external_id: "PAC-001",
    scheduled_at: "2026-10-28T09:00:00Z",
    arrival_time: "08:45",
    kind: "consultation",
    procedure: "Cardiologia - Retorno",
    professional: "Dra. Camila Rocha",
    insurance: "Unimed",
    group: "Ambulatório",
    tracking: {
      id: "t1", version: 1, outcome: "confirmed", response: "confirmed", corrections: 0, observations: 0, messages: 1,
      contacts: [{ phone: "11987654321", delivery: "delivered", response: "confirmed" }]
    }
  },
  {
    id: 2,
    patient: "João Santos (Enviada)",
    external_id: "PAC-002",
    scheduled_at: "2026-10-28T09:30:00Z",
    arrival_time: "09:15",
    kind: "lab",
    procedure: "Hemograma Completo",
    professional: "Laboratório Central",
    insurance: "SUS",
    group: "Exames",
    tracking: {
      id: "t2", version: 1, outcome: "", response: "", corrections: 0, observations: 0, messages: 1,
      contacts: [{ phone: "11976543210", delivery: "sent", response: "pending" }]
    }
  },
  {
    id: 3,
    patient: "Ana Oliveira (Recusada)",
    external_id: "PAC-003",
    scheduled_at: "2026-10-28T10:00:00Z",
    arrival_time: "09:45",
    kind: "consultation",
    procedure: "Dermatologia",
    professional: "Dr. Marcos Lima",
    insurance: "Bradesco",
    group: "Ambulatório",
    tracking: {
      id: "t3", version: 1, outcome: "declined", response: "declined", corrections: 0, observations: 0, messages: 1,
      contacts: [{ phone: "11965432109", delivery: "delivered", response: "declined" }]
    }
  },
  {
    id: 4,
    patient: "Carlos Ferreira (Erro no envio)",
    external_id: "PAC-004",
    scheduled_at: "2026-10-28T10:30:00Z",
    arrival_time: "10:15",
    kind: "exam",
    procedure: "Ecocardiograma",
    professional: "Dra. Camila Rocha",
    insurance: "Particular",
    group: "Métodos Gráficos",
    tracking: {
      id: "t4", version: 1, outcome: "", response: "", corrections: 0, observations: 0, messages: 1,
      contacts: [{ phone: "11954321098", delivery: "failed", status: "invalid" }]
    }
  },
  {
    id: 5,
    patient: "Pedro Souza (Não enviado)",
    external_id: "PAC-005",
    scheduled_at: "2026-10-28T11:00:00Z",
    arrival_time: "10:45",
    kind: "consultation",
    procedure: "Clínica Médica",
    professional: "Dr. Roberto Alves",
    insurance: "SUS",
    group: "Triagem",
    tracking: {
      id: "t5", version: 1, outcome: "", response: "", corrections: 0, observations: 0, messages: 0,
      contacts: []
    }
  }
];

const sampleMessages = [
  {
    id: 1,
    recipient: "5511987654321",
    patient: "Maria Silva",
    state: "delivered",
    response_state: "confirmed",
    scheduled_for: "2026-10-28T09:00:00Z",
    text: "Olá Maria, confirmamos sua consulta."
  },
  {
    id: 2,
    recipient: "5511976543210",
    patient: "João Santos",
    state: "sent",
    response_state: "pending",
    scheduled_for: "2026-10-28T09:30:00Z",
    text: "Olá João, seu exame está agendado."
  }
];

const canvasColumns = ["Paciente", "Status", "Data", "Unidade", "Especialidade", "Profissional"];
const canvasRows = [
  ["Maria Silva", "Confirmado", "2026-10-28", "AME Votuporanga", "Cardiologia", "Dra. Camila"],
  ["João Santos", "Enviado", "2026-10-28", "AME Votuporanga", "Laboratório", "Dr. Roberto"],
  ["Ana Oliveira", "Recusado", "2026-10-28", "AME Votuporanga", "Dermatologia", "Dr. Marcos"]
];

const canvasLayout = {
  schema_version: 1,
  page: { width: 1000, height: 1250, columns: 24, background: "#ffffff" },
  sources: [
    {
      id: "dados",
      type: "report",
      report_id: 1,
      dataset: "dados",
      parameters: { start: { parameter: "start" }, end: { parameter: "end" } }
    }
  ],
  pages: [
    {
      id: "p1",
      name: "Página 1",
      blocks: [
        {
          id: "b1",
          type: "table",
          source_id: "dados",
          title: "Acompanhamentos do Dia",
          x: 40,
          y: 40,
          width: 920,
          height: 380,
          options: { columns: canvasColumns }
        }
      ]
    }
  ]
};

async function setupPageRoutes(page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;

    if (p.endsWith('/auth/csrf/')) {
      return route.fulfill({ json: { csrfToken: 'synthetic-token' } });
    }
    if (p.endsWith('/auth/session/')) {
      return route.fulfill({
        json: {
          username: 'admin',
          full_name: 'Administrador Órbita',
          units: [{ id: 1, slug: 'ame', name: 'AME Noturno', paused: false }],
          roles: { ame: 'admin' },
          mode: 'simulated',
          policy: { users: 'write', config: 'write' }
        }
      });
    }
    if (p.includes('/workspace') || p.includes('/control')) {
      return route.fulfill({
        json: {
          control: {
            unit: { id: 1, slug: 'ame', name: 'AME Noturno', paused: false },
            mode: 'simulated',
            test_recipients: [],
            oracle_configured: true,
            appointment_source: 'oracle',
            meta_configured: true,
            production_enabled: false,
            legacy_exclusion: false,
          },
          indicators: {
            appointments: 5,
            messages: 4,
            accepted: 1,
            delivered: 2,
            confirmed: 1,
            declined: 1,
            no_response: 1,
            issues: 1,
            synthetic_appointments: 0,
            states: { confirmed: 1, sent: 1, declined: 1, failed: 1, not_sent: 1 },
            responses: { confirmed: 1, declined: 1, pending: 1 },
            by_kind: [{ kind: 'consultation', count: 3 }, { kind: 'exam', count: 2 }],
            trend: [
              { hour: '08:00', total: 1 },
              { hour: '09:00', total: 2 },
              { hour: '10:00', total: 2 }
            ],
          },
          appointments: { items: sampleAppointments, total: 5, page: 1, pages: 1 },
          messages: { items: sampleMessages, total: 2, page: 1, pages: 1 },
          replies: { items: [], total: 0, page: 1, pages: 1 },
          issues: { items: [{ id: 'i1', patient: 'Carlos Ferreira', external_id: 'PAC-004', description: 'DDD inválido' }], total: 1, page: 1, pages: 1 },
          rules: { items: [{ id: 1, name: 'Regra Noturno Geral', enabled: true }], total: 1, page: 1, pages: 1 },
          templates: { items: [], total: 0, page: 1, pages: 1 },
          imports: { items: [], total: 0, page: 1, pages: 1 },
          audit: { items: [], total: 0, page: 1, pages: 1 },
        }
      });
    }
    if (p.includes('/agenda-items/types')) {
      return route.fulfill({
        json: [
          { value: 'consultation', label: 'Consulta', group: 'Consultas' },
          { value: 'exam', label: 'Exame', group: 'Exames' },
          { value: 'lab', label: 'Laboratório', group: 'Exames' }
        ]
      });
    }
    if (p.includes('/agenda-items/counts')) {
      return route.fulfill({ json: { total: 5, confirmed: 1, sent: 1, declined: 1, error: 1, not_sent: 1 } });
    }
    if (p.includes('/agenda-items') || p.includes('/appointments')) {
      return route.fulfill({ json: { count: 5, results: sampleAppointments } });
    }
    if (p.includes('/appointment-groups')) {
      return route.fulfill({
        json: {
          count: 2,
          results: [
            { id: 'g1', appointment_date: '2026-10-28', kind: 'consultation', total: 15, sent: 12, confirmed: 8, declined: 2 },
            { id: 'g2', appointment_date: '2026-10-29', kind: 'exam', total: 8, sent: 0, confirmed: 0, declined: 0 }
          ]
        }
      });
    }
    if (p.includes('/sheet-imports/schema')) {
      return route.fulfill({ json: { version: 1, default_mappings: { table: {} } } });
    }
    if (p.includes('/sheet-imports')) {
      return route.fulfill({
        json: {
          count: 1,
          results: [
            {
              id: 'imp-1',
              filename: 'agenda_cross_20261028.xlsx',
              imported_at: '2026-10-28T08:00:00Z',
              total_records: 120,
              state: 'processed',
              layout_name: 'Layout Padrão',
              template_name: 'Template Confirmação',
              errors: [],
              control_status: { message_counts: { accepted: 0, sent: 10, delivered: 10, read: 5, queued: 0, failed: 0 } }
            }
          ]
        }
      });
    }
    if (p.includes('/campaigns')) {
      return route.fulfill({ json: { count: 1, results: [{ id: 'c1', name: 'Comunicação Pré-operatória', state: 'draft', sends_enabled: true }] } });
    }
    if (p.includes('/layouts')) {
      return route.fulfill({ json: { count: 1, results: [{ id: 'l1', name: 'Layout Padrão' }] } });
    }
    if (p.includes('/templates')) {
      return route.fulfill({ json: { count: 1, results: [{ id: 't1', name: 'Template Confirmação' }] } });
    }
    if (p.includes('/cases')) {
      return route.fulfill({ json: { count: 0, results: [] } });
    }
    if (p.includes('/issues')) {
      return route.fulfill({
        json: {
          count: 1,
          results: [
            { id: 'i1', patient: 'Carlos Ferreira', external_id: 'PAC-004', description: 'Telefone com formato incorreto (faltando dígito)', state: 'pending', created_at: '2026-10-28T10:30:00Z' }
          ]
        }
      });
    }
    if (p.includes('/messages')) {
      return route.fulfill({ json: { count: 2, results: sampleMessages } });
    }
    if (p.includes('/overview')) {
      return route.fulfill({
        json: {
          counts: { total: 5, confirmed: 1, sent: 1, declined: 1, error: 1, not_sent: 1 },
          hourly: [{ hour: '09:00', count: 2 }, { hour: '10:00', count: 3 }]
        }
      });
    }
    if (p.includes('/costs') || p.includes('/meta-costs')) {
      return route.fulfill({
        json: {
          summary: { total_spent: 1250.40, messages_sent: 3500, average_cost: 0.35 },
          items: []
        }
      });
    }
    if (p.includes('/canvas-source-preview/')) {
      return route.fulfill({
        json: {
          columns: canvasColumns.map(name => ({ name, type: 'text' })),
          rows: canvasRows,
          total_rows: 3,
          truncated: false
        }
      });
    }
    if (/\/reports\/\d+\/canvas\/$/.test(p)) {
      return route.fulfill({
        json: {
          version: 1,
          layout: canvasLayout,
          enabled: false,
          output_format: 'pdf',
          parameter_editor: [
            { name: 'start', type: 'date', uses: ['dados'], status: 'Usado' },
            { name: 'end', type: 'date', uses: ['dados'], status: 'Usado' }
          ],
          sources: [
            { id: 'dados', name: 'Acompanhamentos e contatos', code: 'dados', columns: canvasColumns, datasets: [{ id: 'dados', name: 'Dados' }] }
          ],
          assets: [],
          monthly_goals: []
        }
      });
    }
    if (/\/reports\/\d+\/$/.test(p)) {
      return route.fulfill({
        json: {
          id: 1,
          name: 'Atendimentos e Desempenho Mensal',
          version: 1,
          catalog_kind: 'report',
          enabled: true,
          parameter_schema: { start: { type: 'date' }, end: { type: 'date' } }
        }
      });
    }
    if (p.includes('/reports')) {
      return route.fulfill({
        json: {
          count: 2,
          results: [
            { id: 1, name: 'Atendimentos e Desempenho Mensal', version: 1, catalog_kind: 'report', enabled: true, layout: canvasLayout },
            { id: 2, name: 'Metas e Vidas por Especialidade', version: 1, catalog_kind: 'report', enabled: true, layout: {} }
          ],
          next: null
        }
      });
    }

    return route.fulfill({ json: { count: 0, results: [] } });
  });
}

(async () => {
  console.log(`Starting Visual QA against ${BASE_URL}...`);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const capturedFiles = [];

  try {
    for (const theme of ['light', 'dark']) {
      console.log(`\n=== Capturing Theme: ${theme.toUpperCase()} ===`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      await setupPageRoutes(page);

      await page.addInitScript(({ th }) => {
        try { localStorage.setItem('orbita:theme', th); } catch(e) {}
      }, { th: theme });

      const saveShot = async (name) => {
        const fullPath = path.join(PRINTS_DIR, `${name}-${theme}.png`);
        await page.screenshot({ path: fullPath });
        capturedFiles.push(fullPath);
        console.log(`  ✓ Saved: ${path.basename(fullPath)} (${(fs.statSync(fullPath).size / 1024).toFixed(1)} KB)`);
      };

      const applyTheme = async () => {
        await page.evaluate(({ th }) => {
          document.documentElement.setAttribute('data-theme', th);
        }, { th: theme });
      };

      // 1. Lista de Agendamentos / Atendimentos
      await page.goto(`${BASE_URL}/agendamentos?unit=ame`);
      await page.waitForSelector('.sidebar, .topbar', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-01-atendimentos');

      // 2. Visão Geral
      await page.goto(`${BASE_URL}/visao-geral?unit=ame`);
      await page.waitForSelector('.sidebar, .overview-workspace, .overview-data-grid', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-02-visao-geral');

      // 3. Mensagens
      await page.goto(`${BASE_URL}/mensagens?unit=ame`);
      await page.waitForSelector('.sidebar, .directory-table', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-03-mensagens');

      // 4. Grupos de Agendamento
      await page.goto(`${BASE_URL}/grupos?unit=ame`);
      await page.waitForSelector('.sidebar, .directory-table, h2', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-04-grupos');

      // 5. Pendências
      await page.goto(`${BASE_URL}/pendencias?unit=ame`);
      await page.waitForSelector('.sidebar, .directory-table, h2', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-05-pendencias');

      // 6. Importa CROSS
      await page.goto(`${BASE_URL}/importa-cross?unit=ame`);
      await page.waitForSelector('.sidebar, .directory-table', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-06-importa-cross');

      // 7. Relatórios - Lista
      await page.goto(`${BASE_URL}/relatorios?unit=ame`);
      await page.waitForSelector('.sidebar, .report-table, .report-toolbar', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-07-relatorios-lista');

      // 8. Editor do Canvas
      await page.goto(`${BASE_URL}/relatorios/1/canvas?unit=ame`);
      await page.waitForSelector('.cv-root, .cv-topbar', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(600);
      await saveShot('icones-08-canvas-editor');

      // 9. Custos Meta
      await page.goto(`${BASE_URL}/custos-meta?unit=ame`);
      await page.waitForSelector('.sidebar, .finance-workspace, .finance-summary', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-09-custos-meta');

      // 10. Configurações
      await page.goto(`${BASE_URL}/configuracoes?unit=ame`);
      await page.waitForSelector('.sidebar, h2', { timeout: 15000 });
      await applyTheme();
      await page.waitForTimeout(400);
      await saveShot('icones-10-configuracoes');

      // 11. Diálogo Aberto
      await page.goto(`${BASE_URL}/relatorios?unit=ame`);
      await page.waitForSelector('.sidebar, .report-toolbar', { timeout: 15000 });
      await applyTheme();
      const addBtn = page.locator('button').filter({ hasText: 'Adicionar' }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForSelector('.inline-dialog, .modal, [role="dialog"]', { timeout: 5000 }).catch(() => {});
      }
      await page.waitForTimeout(400);
      await saveShot('icones-11-dialogo-aberto');

      // 12. Barra lateral recolhida
      await page.goto(`${BASE_URL}/agendamentos?unit=ame`);
      await page.waitForSelector('.sidebar-toggle', { timeout: 15000 });
      await applyTheme();
      const toggle = page.locator('.sidebar-toggle');
      await toggle.click();
      await page.waitForTimeout(400);
      await saveShot('icones-12-sidebar-recolhida');

      // 13. Close-up do botão ThemeToggle (aceso no claro, apagado no escuro)
      const themeToggle = page.locator('.theme-bulb-toggle').first();
      if (await themeToggle.isVisible()) {
        const togglePath = path.join(PRINTS_DIR, `icones-13-theme-toggle-${theme}.png`);
        await themeToggle.screenshot({ path: togglePath });
        capturedFiles.push(togglePath);
        console.log(`  ✓ Saved close-up: ${path.basename(togglePath)}`);
      }

      await context.close();
    }

    console.log(`\nVerifying hash uniqueness among captured screenshots...`);
    const hashes = new Map();
    let duplicates = 0;
    for (const file of capturedFiles) {
      const h = md5(file);
      if (hashes.has(h)) {
        console.warn(`  ⚠️ DUPLICATE DETECTED: ${path.basename(file)} is identical to ${path.basename(hashes.get(h))}`);
        duplicates++;
      } else {
        hashes.set(h, file);
      }
    }

    if (duplicates === 0) {
      console.log(`  ✓ SUCCESS: All ${capturedFiles.length} captured screenshots have unique content hashes!`);
    } else {
      console.error(`  ❌ FAILED: Found ${duplicates} duplicate screenshot(s)!`);
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Visual QA Error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
