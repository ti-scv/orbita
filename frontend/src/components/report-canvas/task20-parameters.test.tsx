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
  fireEvent.click(screen.getByRole("button", {name:"Selecionar não usados"}));
  expect(screen.getByRole("checkbox").getAttribute("type")).toBe("checkbox");
  fireEvent.click(screen.getByRole("button", {name:"Excluir selecionados"}));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("ANTIGO"));
  expect(change).toHaveBeenCalledWith([{name:"ANTIGO"}]);
 });
});

it("impede selecionar ou excluir parâmetros em uso", () => {
 const change=vi.fn();
 render(<ParameterEditor items={[{name:"start",status:"Usado",uses:["Consulta atual: :start"],suggestion:"",historical:false}]} edits={[]} onChange={change} />);
 fireEvent.click(screen.getByRole("button",{name:/Editar parâmetros/}));
 expect(screen.getByTitle("Consulta atual: :start")).toBeTruthy();
 expect(screen.getByLabelText("Em uso: remova dos blocos antes de excluir")).toBeTruthy();
 expect(screen.queryByRole("checkbox")).toBeNull();
 expect(screen.queryByRole("button",{name:"Excluir parâmetro start"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Selecionar não usados"})).toBeNull();
 expect(change).not.toHaveBeenCalled();
});
