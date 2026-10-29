// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import ReportWorkspace from "./ReportWorkspace";
import { request } from "../api";

vi.mock("../api", () => ({
  query: (path: string) => path,
  request: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("coloca a remoção na edição e mantém o bloqueio pela flag", async () => {
  const row = { id: 1, name: "Vendas", code: "vendas", version: 2, enabled: false, source: "sql", output_format: "pdf", parameter_schema: {}, components: [], keywords: [] };
  vi.mocked(request).mockImplementation(async (path: string) => {
    if (path === "reports/inventory") return {};
    if (path === "reports/1") return { parameter_audit: {items: [], component_issues: []} };
    if (path === "reports/1/dependencias") return {dependencias: [], remocao_disponivel: false};
    if (path.endsWith("/users")) return [];
    return {results: path === "reports" ? [row] : [], count: 1, next: null};
  });
  render(<ReportWorkspace unit="ame" admin operate />);
  const edit = await screen.findByRole("button", {name: "Editar Vendas"});
  expect(screen.queryByRole("button", {name: "Remover relatório Vendas"})).toBeNull();
  expect(screen.queryByText("Desative o relatório antes de removê-lo.")).toBeNull();
  expect(screen.queryByRole("tab", {name: /Instâncias do app/})).toBeNull();
  fireEvent.click(edit);
  const editor = screen.getByRole("dialog", {name: /Editar · Relatórios/});
  fireEvent.click(within(editor).getByRole("button", {name: "Remover relatório Vendas"}));
  expect(await screen.findByText(/A remoção está desativada/)).toBeTruthy();
  expect((screen.getByRole("button", {name: /^Remover$/}) as HTMLButtonElement).disabled).toBe(true);
});

it("confirma remoção, mostra o resultado persistido e restaura a detecção", async () => {
  const row = { id: 1, name: "Vendas", code: "vendas", version: 2, enabled: false, source: "sql", output_format: "pdf", parameter_schema: {}, components: [], keywords: [] };
  const item = {name: "inicio", origin: "Consulta SQL", report_code: "vendas", type: "Data", status: "pending", audit_key: "key"};
  let audit: any = {items: [item], component_issues: []};
  vi.mocked(request).mockImplementation(async (path: string, method?: string, body?: any) => {
    if (path === "reports/inventory") return {};
    if (path === "reports/1") return {parameter_audit: audit};
    if (path === "reports/1/dependencias") return {dependencias: [], remocao_disponivel: false};
    if (path === "reports/1/parameter-audit" && method === "POST") {
      audit = body.operation === "restore" ? {items: [item], component_issues: []} :
        {items: [], component_issues: [], has_exclusions: true, hidden_all: body.operation === "remove_all"};
      return {version: body.version + 1, parameter_audit: audit};
    }
    if (path.endsWith("/users")) return [];
    return {results: path === "reports" ? [row] : [], count: 1, next: null};
  });
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
  render(<ReportWorkspace unit="ame" admin operate />);
  fireEvent.click(await screen.findByRole("button", {name: "Editar Vendas"}));
  const remove = await screen.findByRole("button", {name: "Remover parâmetro inicio"});
  fireEvent.click(remove);
  expect(vi.mocked(request).mock.calls.filter(call => call[0] === "reports/1/parameter-audit")).toHaveLength(0);
  fireEvent.click(remove);
  fireEvent.click(await screen.findByRole("button", {name: "Restaurar detecção automática"}));
  await screen.findByRole("button", {name: "Remover parâmetro inicio"});
  fireEvent.click(screen.getByRole("button", {name: "Remover bloco"}));
  expect(await screen.findByText("Bloco removido.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Restaurar detecção automática"}));
  expect(await screen.findByRole("button", {name: "Remover parâmetro inicio"})).toBeTruthy();
  expect(vi.mocked(request).mock.calls.filter(call => call[0] === "reports/1/parameter-audit").map(call => (call[2] as any).version)).toEqual([2, 3, 4, 5]);
  confirm.mockRestore();
});
