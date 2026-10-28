// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import DataPanel from "./data/DataPanel";
import SourceDialog from "./data/SourceDialog";
import { createSourceModalState } from "./data/sourceOps";
import type { SourceDialogState } from "./model";

afterEach(cleanup);
const catalog = [{id: 2, name: "Zebra", code: "z"}, {id: 1, name: "Agenda", code: "a"}];
function mount(override: Partial<SourceDialogState> = {}) {
  const initial = createSourceModalState([], catalog);
  if (!initial.ok) throw new Error(initial.error);
  const initialState = initial.state;
  const submit = vi.fn((e) => e.preventDefault());
  function Harness() {
    const [state, setState] = useState<SourceDialogState | null>({...initialState, ...override});
    return <SourceDialog sourceModal={state} availableSources={catalog} onChange={setState} onClose={() => setState(null)} onSubmit={submit} />;
  }
  render(<Harness />);
  return submit;
}
it("item 3: zero linhas é aviso, não sucesso", () => {
  mount({testPreview: {columns: [], rows: [], total_rows: 0, truncated: false}});
  expect(screen.getByText(/não trouxe nenhuma linha/)).toBeTruthy();
  expect(screen.queryByText("Teste com sucesso")).toBeNull();
});
it("item 8: metas vazias bloqueiam adicionar e explicam", () => {
  mount({type: "goals", label: "Metas"});
  expect((screen.getByRole("button", {name: "Adicionar"}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Nenhuma meta cadastrada/)).toBeTruthy();
});
it("item 11: escolha inicial usa o nome do relatório", () => {
  mount();
  Element.prototype.scrollIntoView = vi.fn();
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", {name: "Agenda"}));
  expect((screen.getByLabelText("Nome da fonte") as HTMLInputElement).value).toBe("Agenda");
});
it("item 12: setas movem foco e apenas a aba selecionada recebe tab stop", () => {
  mount();
  const tabs = screen.getAllByRole("tab");
  expect(tabs.map(t => t.tabIndex)).toEqual([0, -1, -1]);
  tabs[0].focus(); fireEvent.keyDown(tabs[0], {key: "ArrowRight"});
  expect(document.activeElement).toBe(tabs[1]);
  fireEvent.click(tabs[1]);
  expect(tabs.map(t => t.tabIndex)).toEqual([-1, 0, -1]);
  expect(tabs[1].getAttribute("aria-selected")).toBe("true");
});
it("item 13: submissão inválida não confirma e foca relatório", () => {
  const submit = mount({label: "Fonte"});
  const form = screen.getByRole("dialog").querySelector("form")!;
  fireEvent.submit(form);
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("Escolha um relatório");
  expect(document.activeElement).toBe(screen.getByRole("combobox"));
});

it("item 6: amostras reais de resposta e resultado são apresentadas e responsável vazio é identificado", () => {
  // Snapshot de tipos e valores não identificadores da cópia do canvas 1.
  const data = {columns: [
    {name: "Resposta", type: "text" as const, sample: ["answered"]},
    {name: "Resultado", type: "text" as const, sample: ["confirmed"]},
    {name: "Responsável", type: "unknown" as const, sample: []},
  ], rows: [["answered", "confirmed", ""]], total_rows: 1, truncated: false};
  render(<DataPanel active sources={[{id: "dados", type: "report", report_id: 1}]} availableSources={[]} onCreateSource={vi.fn()} onEditSource={vi.fn()} onRemoveSource={vi.fn()} stagePreviewStates={{dados: {status: "ready", data, error: null, loadedAt: null}}} />);
  fireEvent.click(screen.getByRole("button", {expanded: false}));
  expect(screen.getByText("Exemplo: Respondido")).toBeTruthy();
  expect(screen.getByText("Exemplo: Confirmado")).toBeTruthy();
  expect(screen.getByText("Sem valores")).toBeTruthy();
});
