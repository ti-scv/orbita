// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

describe("Tarefa 22: pequenos bugs visuais do editor de Canvas e das listas de relatórios", () => {
  it("paginação da lista de relatórios e coletas possui respiro lateral e separador superior", async () => {
    // @ts-ignore
    const fs = await import("node:fs");
    // @ts-ignore
    const path = await import("node:path");
    // @ts-ignore
    const reportsCss = fs.readFileSync(path.resolve(process.cwd(), "src/reports.css"), "utf-8");
    // @ts-ignore
    const operationsCss = fs.readFileSync(path.resolve(process.cwd(), "src/operations.css"), "utf-8");

    expect(reportsCss).toContain(".report-workspace .op-pager");
    expect(reportsCss).toMatch(/\.report-workspace \.op-pager\s*\{[^}]*padding:\s*14px 22px;/);
    expect(reportsCss).toMatch(/\.report-workspace \.op-pager\s*\{[^}]*border-top:/);
    expect(reportsCss).toContain(".snapshot-workspace > .report-actions");
    expect(reportsCss).toMatch(/\.snapshot-workspace > \.report-actions\s*\{[^}]*padding:\s*14px 22px;/);
    expect(operationsCss).toMatch(/\.op-pager\s*\{[^}]*padding:\s*12px 20px;/);
  });

  it("botão salvar e botões da barra superior possuem altura consistente de 28px", async () => {
    // @ts-ignore
    const fs = await import("node:fs");
    // @ts-ignore
    const path = await import("node:path");
    // @ts-ignore
    const shellCss = fs.readFileSync(path.resolve(process.cwd(), "src/components/report-canvas/shell.css"), "utf-8");

    expect(shellCss).toContain(".cv-root .cv-topbar .cv-btn-primary");
    expect(shellCss).toMatch(/\.cv-root \.cv-topbar \.cv-btn-primary\s*\{[^}]*height:\s*var\(--cv-h-control\);/);
    expect(shellCss).toMatch(/\.cv-root \.cv-rail-tab-label\s*\{[^}]*text-overflow:\s*ellipsis;/);
  });

  it("cabeçalho de dados possui altura fixa de 36px consistente com os outros painéis", async () => {
    // @ts-ignore
    const fs = await import("node:fs");
    // @ts-ignore
    const path = await import("node:path");
    // @ts-ignore
    const dataCss = fs.readFileSync(path.resolve(process.cwd(), "src/components/report-canvas/data.css"), "utf-8");

    expect(dataCss).toMatch(/\.cv-data-head\s*\{[^}]*height:\s*36px;/);
    expect(dataCss).toMatch(/\.cv-data-head\s*\{[^}]*flex:\s*0 0 36px;/);
    expect(dataCss).toMatch(/\.cv-search-input:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--cv-focus\);/);
    expect(dataCss).toMatch(/\.cv-grid-input:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--cv-focus\);/);
  });

  it("rodapé de diálogos padroniza altura dos botões primários e secundários", async () => {
    // @ts-ignore
    const fs = await import("node:fs");
    // @ts-ignore
    const path = await import("node:path");
    // @ts-ignore
    const dialogsCss = fs.readFileSync(path.resolve(process.cwd(), "src/components/report-canvas/dialogs.css"), "utf-8");

    expect(dialogsCss).toContain(".modal.inline-dialog.cv-subdialog .cv-btn-primary");
    expect(dialogsCss).toMatch(/\.modal\.inline-dialog\.cv-subdialog \.cv-btn-primary\s*\{[^}]*height:\s*var\(--cv-h-control\);/);
  });

  it("estados desabilitados não acumulam opacidade excessiva no tema escuro", async () => {
    // @ts-ignore
    const fs = await import("node:fs");
    // @ts-ignore
    const path = await import("node:path");
    // @ts-ignore
    const shellCss = fs.readFileSync(path.resolve(process.cwd(), "src/components/report-canvas/shell.css"), "utf-8");
    // @ts-ignore
    const libraryCss = fs.readFileSync(path.resolve(process.cwd(), "src/components/report-canvas/library.css"), "utf-8");
    // @ts-ignore
    const inspectorCss = fs.readFileSync(path.resolve(process.cwd(), "src/components/report-canvas/inspector.css"), "utf-8");

    expect(shellCss).toMatch(/\[data-theme="dark"\] \.cv-root \.cv-seg-btn:disabled\s*\{[^}]*opacity:\s*1;/);
    expect(libraryCss).toMatch(/\.cv-root \.cv-panel-icon-btn:disabled\s*\{[^}]*opacity:\s*1;/);
    expect(inspectorCss).toMatch(/\[data-theme="dark"\] \.cv-root \.cv-seg-item:disabled\s*\{[^}]*opacity:\s*1;/);
  });

  it("linhas da lista de páginas possuem respiro de 8px na margem direita", async () => {
    // @ts-ignore
    const fs = await import("node:fs");
    // @ts-ignore
    const path = await import("node:path");
    // @ts-ignore
    const libraryCss = fs.readFileSync(path.resolve(process.cwd(), "src/components/report-canvas/library.css"), "utf-8");

    expect(libraryCss).toMatch(/\.cv-root \.cv-page-row\s*\{[^}]*padding:\s*2px var\(--cv-sp-2\);/);
  });
});
