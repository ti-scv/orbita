const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 8093;
const DIST_DIR = process.env.ORBITA_DIST || '/opt/orbita-icones/frontend/dist';
const PRINTS_DIR = process.env.ORBITA_PRINTS || '/opt/orbita-icones/docs/icones-qa-prints';

fs.mkdirSync(PRINTS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

// 1. Static file server on port 8093
const server = http.createServer((req, res) => {
  let reqPath = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
  if (reqPath === '/' || !path.extname(reqPath)) {
    reqPath = '/index.html';
  }
  const filePath = path.join(DIST_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Staging server running at http://127.0.0.1:${PORT}`);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  try {
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

    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      page.on('pageerror', err => console.log('PAGE ERROR STACK:', err.stack));
      page.on('response', resp => { if (!resp.ok()) console.log('HTTP', resp.status(), resp.url()); });

      // Mock all backend API calls synthetically
      await page.route('**/api/**', async route => {
        const req = route.request();
        const p = new URL(req.url()).pathname;
        console.log('API REQUEST:', req.method(), p);
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
          const emptyPaginated = { items: sampleAppointments, total: sampleAppointments.length, page: 1, pages: 1 };
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
                issues: 0,
                synthetic_appointments: 0,
                states: {},
                responses: {},
                by_kind: [],
                trend: [],
              },
              appointments: emptyPaginated,
              messages: { items: [], total: 0, page: 1, pages: 1 },
              replies: { items: [], total: 0, page: 1, pages: 1 },
              issues: { items: [], total: 0, page: 1, pages: 1 },
              rules: { items: [], total: 0, page: 1, pages: 1 },
              templates: { items: [], total: 0, page: 1, pages: 1 },
              imports: { items: [], total: 0, page: 1, pages: 1 },
              audit: { items: [], total: 0, page: 1, pages: 1 },
            }
          });
        }
        if (p.includes('/agenda-items/types') || p.includes('/specialties') || p.includes('/professionals') || p.includes('/groups')) {
          return route.fulfill({ json: [] });
        }
        if (p.includes('/agenda-items/counts') || p.includes('/counts')) {
          return route.fulfill({ json: { total: 5, confirmed: 1, sent: 1, declined: 1, error: 1, not_sent: 1 } });
        }
        if (p.includes('/appointments') || p.includes('/agenda-items')) {
          return route.fulfill({
            json: {
              count: sampleAppointments.length,
              next: null,
              previous: null,
              results: sampleAppointments
            }
          });
        }
        if (p.includes('/overview')) {
          return route.fulfill({
            json: {
              counts: { total: 5, confirmed: 1, sent: 1, declined: 1, error: 1, not_sent: 1 },
              hourly: []
            }
          });
        }
        return route.fulfill({ json: {} });
      });

      // Set theme in localStorage before page load
      await page.addInitScript(({ th }) => {
        try { localStorage.setItem('orbita:theme', th); } catch(e) {}
      }, { th: theme });

      await page.goto(`http://127.0.0.1:${PORT}/?unit=ame`);
      await page.waitForSelector('.sidebar, .topbar', { timeout: 15000 });
      await page.waitForTimeout(500);

      // Force HTML data-theme
      await page.evaluate(({ th }) => {
        document.documentElement.setAttribute('data-theme', th);
      }, { th: theme });

      // 1. Capture Sidebar + Header
      const sidebarShot = path.join(PRINTS_DIR, `icones-01-sidebar-${theme}.png`);
      await page.screenshot({ path: sidebarShot });
      console.log(`Saved screenshot: ${sidebarShot}`);

      // 2. Click to Operations tab (Atendimentos da unidade)
      const opsTab = page.locator('button, a').filter({ hasText: 'Atendimentos' }).first();
      if (await opsTab.isVisible()) {
        await opsTab.click();
        await page.waitForTimeout(400);
      }

      // 3. Capture Appointments Table (User and WhatsApp Status icons)
      const tableShot = path.join(PRINTS_DIR, `icones-02-tabela-atendimentos-${theme}.png`);
      await page.screenshot({ path: tableShot });
      console.log(`Saved screenshot: ${tableShot}`);

      // 4. Capture ThemeToggle button close-up
      const themeToggle = page.locator('.theme-bulb-toggle').first();
      if (await themeToggle.isVisible()) {
        const toggleShot = path.join(PRINTS_DIR, `icones-03-theme-toggle-${theme}.png`);
        await themeToggle.screenshot({ path: toggleShot });
        console.log(`Saved screenshot: ${toggleShot}`);
      }

      await context.close();
    }

    // Copy the 98-icon matrix screenshot into PRINTS_DIR
    if (fs.existsSync('/tmp/orbita-icones-98.png')) {
      fs.copyFileSync('/tmp/orbita-icones-98.png', path.join(PRINTS_DIR, 'icones-04-matriz-98-duotone.png'));
      console.log(`Copied 98-icon matrix to ${path.join(PRINTS_DIR, 'icones-04-matriz-98-duotone.png')}`);
    }

    console.log('Visual QA completed successfully!');
  } catch (err) {
    console.error('QA Error:', err);
  } finally {
    await browser.close();
    server.close();
  }
});
