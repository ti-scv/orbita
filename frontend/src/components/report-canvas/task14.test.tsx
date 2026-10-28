// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import DataDrawer from "./data/DataDrawer";
import SourceDialog from "./data/SourceDialog";
import { editSourceModalState } from "./data/sourceOps";
import { formatCellValue } from "./data/columnTypes";
import { displayCanvasValue } from "./common/displayValue";
import type { CanvasSource, SourceDialogState, SourcePreview } from "./model";

afterEach(cleanup);
const empty: SourcePreview = { columns: [], rows: [], total_rows: 0, truncated: false, elapsed_ms: 1 };
const source: CanvasSource = { id: "dados", type: "report", report_id: 6 };

describe("Tarefa 14: datas na gaveta e nos blocos", () => {
  it.each([
    ["2026-09-21T00:00:00", "21/09/2026"],
    ["2026-09-21 00:00:00.000", "21/09/2026"],
    ["2026-09-21T00:00:00-03:00", "21/09/2026"],
    ["2026-09-21", "21/09/2026"],
    ["2026-09-21T14:35:09-03:00", "21/09/2026 14:35"],
    ["2026-09-21 08:15", "21/09/2026 08:15"],
    ["2026-09-21T00:00:01", "21/09/2026 00:00"],
    ["2026-02-30T00:00:00", "2026-02-30T00:00:00"],
    ["2026-09-21T25:00:00", "2026-09-21T25:00:00"],
  ])("mostra %s como %s sem converter fuso nem alterar a fonte", (value, expected) => {
    for (const type of ["date", "datetime", "text", "unknown", undefined] as const)
      expect(formatCellValue(value, type)).toBe(expected);
    expect(displayCanvasValue(value)).toBe(expected);
  });
  it("renderiza datas e horas formatadas na tabela da gaveta", () => {
    const preview: SourcePreview = {
      ...empty,
      columns: [{ name: "Data", type: "datetime", nullable: false, null_count: 0 }],
      rows: [["2026-09-21T00:00:00"], ["2026-09-21T14:35:09"]],
      total_rows: 2,
    };
    const original = JSON.stringify(preview);
    render(<DataDrawer source={source} preview={preview} onClose={vi.fn()} />);
    expect(screen.getAllByText("21/09/2026")[0]).toBeTruthy();
    expect(screen.getByText("21/09/2026 14:35")).toBeTruthy();
    expect(JSON.stringify(preview)).toBe(original);
  });
});

describe("Tarefa 14: nome consistente na edição de fonte", () => {
  it.each([
    [{ ...source }, "dados"],
    [{ ...source, label: "" }, "dados"],
    [{ ...source, label: "Atendimentos" }, "Atendimentos"],
    [{ id: "manual", type: "inline", columns: ["A"], rows: [] }, "manual"],
    [{ id: "metas", type: "goals" }, "metas"],
  ] as Array<[CanvasSource, string]>)("preenche o nome visível sem alterar o registro (%s)", (src, expected) => {
    const original = JSON.stringify(src);
    function Harness() {
      const [state, setState] = useState<SourceDialogState | null>(editSourceModalState(src, []));
      return <SourceDialog sourceModal={state} availableSources={[]} existingSources={[src]}
        onChange={setState} onClose={() => setState(null)} onSubmit={vi.fn()} />;
    }
    render(<Harness />);
    const name = screen.getByLabelText("Nome da fonte", { exact: true }) as HTMLInputElement;
    expect(name.value).toBe(expected);
    fireEvent.change(name, { target: { value: "Alteração cancelada" } });
    expect(name.value).toBe("Alteração cancelada");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(JSON.stringify(src)).toBe(original);
  });
});

describe("Tarefa 14: carregamento antes de vazio", () => {
  it("só mostra vazio após terminar a consulta, inclusive ao atualizar", () => {
    const view = render(<DataDrawer source={source} preview={null} loading onClose={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Carregando dados…");
    expect(screen.queryByText("Nenhuma coluna encontrada")).toBeNull();
    expect(screen.queryByText("Nenhuma linha retornada")).toBeNull();
    expect((screen.getByRole("button", { name: "Copiar TSV" }) as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<DataDrawer source={source} preview={empty} onClose={vi.fn()} />);
    expect(screen.getByText("Nenhuma coluna encontrada")).toBeTruthy();
    expect(screen.queryByText("Carregando dados…")).toBeNull();
    view.rerender(<DataDrawer source={source} preview={empty} loading onClose={vi.fn()} />);
    expect(screen.queryByText("Nenhuma coluna encontrada")).toBeNull();
    const withColumns: SourcePreview = { ...empty, columns: [{ name: "Paciente", type: "text", nullable: true, null_count: 0 }] };
    view.rerender(<DataDrawer source={source} preview={withColumns} loading onClose={vi.fn()} />);
    expect(screen.queryByText("Nenhuma linha retornada")).toBeNull();
    view.rerender(<DataDrawer source={source} preview={withColumns} onClose={vi.fn()} />);
    expect(screen.getByText("Nenhuma linha retornada")).toBeTruthy();
  });
});
