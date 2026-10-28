// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ParameterEditor from "./data/ParameterEditor";
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
