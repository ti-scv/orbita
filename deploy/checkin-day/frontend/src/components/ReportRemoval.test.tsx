// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RemovalButton, RemovedRecords } from "./ReportRemoval";
import { request } from "../api";

vi.mock("../api", () => ({
  query: (path: string) => path,
  request: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("confirma a remoção e exibe erro sem fechar o diálogo", async () => {
  vi.mocked(request).mockResolvedValueOnce({ dependencias: [] }).mockRejectedValueOnce(new Error("Falha ao remover"));
  render(<RemovalButton unit="ame" resource="reports" row={{id: 1, name: "Vendas", version: 2}} kind="relatório" onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", {name: "Remover relatório Vendas"}));
  expect(await screen.findByText(/Ele deixará de aparecer/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: /^Remover$/}));
  expect((await screen.findByRole("alert")).textContent).toContain("Falha ao remover");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("mostra dependências e impede a remoção", async () => {
  vi.mocked(request).mockResolvedValueOnce({ dependencias: ["Programação da equipe"] });
  render(<RemovalButton unit="ame" resource="reports" row={{id: 1, name: "Vendas", version: 2}} kind="relatório" onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", {name: "Remover relatório Vendas"}));
  expect(await screen.findByText("Programação da equipe")).toBeTruthy();
  expect((screen.getByRole("button", {name: /^Remover$/}) as HTMLButtonElement).disabled).toBe(true);
});

it("lista e restaura um relatório removido", async () => {
  const changed = vi.fn();
  vi.mocked(request).mockImplementation(async (path) => path.includes("restaurar") ? {} : {results:[{id:1,name:"Vendas",version:3}],next:null});
  render(<RemovedRecords unit="ame" resource="reports" kind="relatório" revision={0} onChanged={changed} />);
  const details = screen.getByText("Relatórios removidos").parentElement as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  expect(await screen.findByText("Vendas")).toBeTruthy();
  const restore = screen.getByRole("button", {name:"Restaurar relatório Vendas"}) as HTMLButtonElement;
  await waitFor(() => expect(restore.disabled).toBe(false));
  fireEvent.click(restore);
  await waitFor(() => expect(changed).toHaveBeenCalled());
});


it("remove um relatório após confirmação", async () => {
  const changed = vi.fn();
  vi.mocked(request).mockResolvedValueOnce({dependencias: []}).mockResolvedValueOnce({name: "Vendas", version: 3});
  render(<RemovalButton unit="ame" resource="reports" row={{id: 1, name: "Vendas", version: 2}} kind="relatório" onChanged={changed} />);
  fireEvent.click(screen.getByRole("button", {name: "Remover relatório Vendas"}));
  const confirm = await screen.findByRole("button", {name: /^Remover$/});
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(confirm);
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(vi.mocked(request)).toHaveBeenCalledWith("reports/1/remover", "POST", {version: 2});
});


it("exibe vínculos e bloqueia a remoção quando ela não está liberada", async () => {
  vi.mocked(request).mockResolvedValueOnce({dependencias: ["Relatório: Vendas"], remocao_disponivel: false});
  render(<RemovalButton unit="ame" resource="report-connections" row={{id: 1, name: "Banco", version: 1}} kind="conexão" onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", {name: "Remover conexão Banco"}));
  expect(await screen.findByText("Relatório: Vendas")).toBeTruthy();
  expect(screen.getByText("Usada por 1 relatório.")).toBeTruthy();
  expect(screen.getByText("A remoção está desativada. Entre em contato com o administrador para solicitar a liberação.")).toBeTruthy();
  expect((screen.getByRole("button", {name: /^Remover$/}) as HTMLButtonElement).disabled).toBe(true);
});

it("explica ausência de vínculos sem repetir bloqueios", async () => {
  vi.mocked(request).mockResolvedValueOnce({dependencias: [], remocao_disponivel: false});
  render(<RemovalButton unit="ame" resource="reports" row={{id: 1, name: "Vendas", version: 1}} kind="relatório" onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", {name: "Remover relatório Vendas"}));
  expect(await screen.findByText("Sem agendamentos nem vínculos.")).toBeTruthy();
  expect(screen.queryByText(/Remoção bloqueada/)).toBeNull();
});


it("explica e bloqueia a remoção de relatório ativo antes do clique", () => {
  render(<RemovalButton unit="ame" resource="reports" row={{id: 1, name: "Vendas", version: 1}} kind="relatório" active onChanged={() => {}} />);
  expect(screen.getByText("Desative o relatório antes de removê-lo.")).toBeTruthy();
  const button = screen.getByRole("button", {name: /Não é possível remover relatório Vendas/}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.title).toContain("desative o relatório");
  fireEvent.click(button);
  expect(request).not.toHaveBeenCalled();
});
