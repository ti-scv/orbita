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
