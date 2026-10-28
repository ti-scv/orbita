// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import CanvasErrorBoundary from "./shell/CanvasErrorBoundary";
import DataDrawer from "./data/DataDrawer";
import ReportCanvas from "../ReportCanvas";
import { createDefaultLayout } from "./model";

vi.mock("../../api", () => ({
  query: (path: string) => path,
  request: vi.fn(async (path: string) => {
    if (path.includes("canvas-source-preview"))
      return {
        columns: [{ name: "Paciente", type: "text" }],
        rows: [["QA"]],
        total_rows: 1,
      };
    const layout = createDefaultLayout();
    layout.sources = [
      { id: "dados", type: "report", report_id: 6, label: "dados" },
    ];
    return {
      version: 1,
      layout,
      enabled: false,
      output_format: "pdf",
      sources: [
        { id: 6, name: "Relatório QA", code: "qa", columns: ["Paciente"] },
      ],
      assets: [],
      monthly_goals: [],
    };
  }),
}));
beforeAll(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("Tarefa 13: transições reais do canvas", () => {
  it("abre, cancela e reabre editar/adicionar fonte sem mudar a ordem dos hooks", async () => {
    render(
      <ReportCanvas
        unit="ame"
        report={{ id: 6, name: "QA", version: 1 }}
        onClose={() => {}}
      />,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Dados" }));
    for (let n = 0; n < 2; n++) {
      fireEvent.click(
        await screen.findByRole("button", { name: /Editar fonte / }),
      );
      expect(
        await screen.findByRole("dialog", { name: "Editar fonte de dados" }),
      ).toBeTruthy();
      expect(screen.getAllByDisplayValue("dados").length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: "Adicionar fonte" }));
    expect(
      await screen.findByRole("dialog", { name: "Adicionar fonte de dados" }),
    ).toBeTruthy();
    for (const name of [
      "Tabela manual",
      "Metas mensais",
      "Relatório existente",
    ])
      fireEvent.click(screen.getByRole("tab", { name }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(document.body.textContent).toContain("QA");
  });
});

describe("Tarefa 13: Ver dados e proteção de erros", () => {
  it("alterna Ver dados fechado, carregando e pronto sem variar hooks", () => {
    const props = { source: null, preview: null, onClose: () => {} };
    const view = render(<DataDrawer {...props} />);
    const source = {
      id: "dados",
      type: "inline" as const,
      columns: ["Paciente"],
      rows: [["QA"]],
    };
    view.rerender(<DataDrawer {...props} source={source} loading />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    view.rerender(
      <DataDrawer
        {...props}
        source={source}
        preview={{
          columns: [
            { name: "Paciente", type: "text", nullable: false, null_count: 0 },
          ],
          rows: [["QA"]],
          total_rows: 1,
          truncated: false,
          elapsed_ms: 1,
        }}
      />,
    );
    expect(screen.getAllByText("QA")[0]).toBeTruthy();
    view.rerender(<DataDrawer {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(<DataDrawer {...props} source={source} />);
    expect(screen.getAllByText("QA")[0]).toBeTruthy();
  });
  it("mostra erro em português, registra console e preserva estado acima do boundary", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const back = vi.fn();
    let crash = false;
    function Child() {
      if (crash) throw new Error("Falha QA");
      return <p>Editor disponível</p>;
    }
    function Harness() {
      const [text, setText] = useState("Rascunho");
      return (
        <>
          <input
            aria-label="Rascunho"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <CanvasErrorBoundary
            preservesEditor
            dirty
            onBack={back}
            onRetry={() => {
              crash = false;
            }}
          >
            <Child />
          </CanvasErrorBoundary>
        </>
      );
    }
    const view = render(<Harness />);
    fireEvent.change(screen.getByLabelText("Rascunho"), {
      target: { value: "Alteração não salva" },
    });
    crash = true;
    view.rerender(<Harness />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Algo deu errado nesta tela. Seus dados não foram perdidos.",
    );
    expect(logged).toHaveBeenCalledWith(
      "[Canvas] Falha ao renderizar o editor",
      expect.any(Error),
      expect.any(String),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    expect(confirm).toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(screen.getByText("Editor disponível")).toBeTruthy();
    expect(screen.getByDisplayValue("Alteração não salva")).toBeTruthy();
    crash = true;
    view.rerender(<Harness />);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    expect(back).toHaveBeenCalledOnce();
  });
  it("exige confirmação antes de reiniciar o editor inteiro", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false),
      retry = vi.fn();
    let crash = true;
    function Child() {
      if (crash) throw new Error("Falha QA");
      return <p>Recuperado</p>;
    }
    render(
      <CanvasErrorBoundary onBack={() => {}} onRetry={retry}>
        <Child />
      </CanvasErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).not.toHaveBeenCalled();
    crash = false;
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText("Recuperado")).toBeTruthy();
  });
});
