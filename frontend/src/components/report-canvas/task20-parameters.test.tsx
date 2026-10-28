// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import ParameterEditor from "./data/ParameterEditor";
afterEach(() => {cleanup(); vi.restoreAllMocks();});
describe("Parâmetros no rascunho", () => {
 it("seleciona não usados, confirma e não grava automaticamente", () => {
  const change = vi.fn(); vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<ParameterEditor items={[{name:"ANTIGO", status:"Não usado", uses:[], suggestion:"", historical:true}]} edits={[]} onChange={change} />);
  fireEvent.click(screen.getByRole("button", {name:/Editar parâmetros/}));
  fireEvent.click(screen.getByRole("button", {name:"Selecionar todos os não usados"}));
  expect(screen.getByRole("checkbox").getAttribute("type")).toBe("checkbox");
  fireEvent.click(screen.getByRole("button", {name:"Excluir selecionados"}));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("ANTIGO"));
  expect(change).toHaveBeenCalledWith([{name:"ANTIGO"}]);
 });
});

it("avisa onde o parâmetro é usado e permite cancelar pelo diálogo nativo", () => {
 const change=vi.fn(), confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 render(<ParameterEditor items={[{name:"start",status:"Usado",uses:["Consulta atual: :start"],suggestion:"",historical:false}]} edits={[]} onChange={change} />);
 fireEvent.click(screen.getByRole("button",{name:/Editar parâmetros/}));
 fireEvent.click(screen.getByRole("button",{name:"Excluir parâmetro start"}));
 expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Consulta atual: :start"));
 expect(change).not.toHaveBeenCalled();
});
