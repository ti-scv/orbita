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
  expect(await screen.findByText(/Você poderá restaurar/)).toBeTruthy();
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
  vi.mocked(request).mockResolvedValueOnce({results:[{id:1,name:"Vendas",version:3}],next:null}).mockResolvedValueOnce({}).mockResolvedValueOnce({results:[],next:null});
  render(<RemovedRecords unit="ame" resource="reports" kind="relatório" revision={0} onChanged={changed} />);
  const details = screen.getByText("Relatórios removidos").parentElement as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  expect(await screen.findByText("Vendas")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Restaurar relatório Vendas"}));
  await waitFor(() => expect(changed).toHaveBeenCalled());
});

