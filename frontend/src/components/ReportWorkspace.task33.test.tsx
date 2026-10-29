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

it("busca, adiciona, ordena e remove relatórios preservando os dados da composição salva", async () => {
  const row = { id: 1, name: "Composto", code: "composto", version: 2, source: "composite", output_format: "pdf", parameter_schema: {}, components: [{code: "antigo", parameters: {limite: 3}, extra: "preservado"}, {code: "ausente", goal: 2}], keywords: [] };
  const reports = [row, {id: 2, name: "Vendas", code: "antigo"}, {id: 3, name: "Vendas", code: "novo"}, {id: 4, name: "Vendas", code: "outro"}];
  vi.mocked(request).mockImplementation(async (path: string, method?: string) => {
    if (path === "reports/inventory") return {};
    if (path === "reports/1") return {parameter_audit: {items: [], component_issues: []}};
    if (path === "reports/1/configure" && method === "POST") return {id: 1};
    if (path.endsWith("/users")) return [];
    return {results: path === "reports" ? reports : [], count: reports.length, next: null};
  });
  render(<ReportWorkspace unit="ame" admin operate />);
  fireEvent.click(await screen.findByRole("button", {name: "Editar Composto"}));
  const dialog = screen.getByRole("dialog", {name: /Editar · Relatórios/});
  await within(dialog).findByText(/ID 2/);
  expect(within(dialog).getByText(/Relatório não localizado \(ausente\)/)).toBeTruthy();
  expect(within(dialog).queryByLabelText("Componentes (código e parâmetros)")).toBeNull();
  fireEvent.change(within(dialog).getByLabelText("Buscar relatórios por nome"), {target: {value: "vendas"}});
  fireEvent.click(within(dialog).getByRole("button", {name: "Adicionar Vendas ID 3"}));
  expect(within(dialog).getByRole("button", {name: "Adicionar Vendas ID 4"})).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", {name: "Subir Vendas posição 3"}));
  fireEvent.click(within(dialog).getByRole("button", {name: /Remover Relatório não localizado.*posição 3/}));
  fireEvent.click(within(dialog).getByRole("button", {name: /Salvar/}));
  await vi.waitFor(() => expect(vi.mocked(request).mock.calls.some(call => call[0] === "reports/1/configure")).toBe(true));
  const saved = vi.mocked(request).mock.calls.find(call => call[0] === "reports/1/configure")![2] as any;
  expect(saved.components).toEqual([{code: "antigo", parameters: {limite: 3}, extra: "preservado"}, {code: "novo"}]);
});
