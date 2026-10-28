// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import SourceDialog from "./data/SourceDialog";
import DataDrawer from "./data/DataDrawer";
import { createSourceModalState } from "./data/sourceOps";
import type { SourceDialogState } from "./model";
afterEach(cleanup);
const catalog = [{id: 1, name: "Agenda", code: "agenda", columns: ["data_atualizacao", "referencia", "dias_reconstruidos", "total"]}];
function mount() {
 const init = createSourceModalState([], catalog); if (!init.ok) throw new Error(init.error);
 const initialState = init.state;
 function App() { const [state, setState] = useState<SourceDialogState | null>(initialState); return <SourceDialog sourceModal={state} availableSources={catalog} onChange={setState} onClose={() => setState(null)} onSubmit={e => e.preventDefault()} />; }
 render(<App />);
}
it("identifica relatório e troca nome ao mudar de origem; metas vazias bloqueiam teste", () => {
 mount(); Element.prototype.scrollIntoView = vi.fn(); fireEvent.click(screen.getByRole("combobox"));
 fireEvent.click(screen.getByRole("option", {name: /Agenda · agenda · #1/}));
 expect(screen.getByText(/4 colunas: Data de atualização, Referência, Dias reconstruídos e mais 1/)).toBeTruthy();
 fireEvent.click(screen.getByRole("tab", {name: "Metas mensais"}));
 expect((screen.getByLabelText("Nome da fonte") as HTMLInputElement).value).toBe("Metas mensais");
 const test = screen.getByRole("button", {name: "Testar e carregar prévia"}) as HTMLButtonElement;
 expect(test.disabled).toBe(true); expect(test.title).toContain("Cadastre metas");
});
it("gaveta identifica coluna vazia e permite expandir e recolher", () => {
 render(<DataDrawer source={{id:"s",type:"inline",columns:["Responsável"],rows:[[""]]}} preview={{columns:[{name:"Responsável",type:"unknown"}],rows:[[""]],total_rows:1,truncated:false}} onClose={vi.fn()} />);
 expect(screen.getByLabelText("Sem valores").getAttribute("title")).toBe("Sem valores");
 fireEvent.click(screen.getByRole("button", {name:"Expandir"})); expect(screen.getByRole("button", {name:"Recolher"}).getAttribute("aria-expanded")).toBe("true");
 fireEvent.click(screen.getByRole("button", {name:"Recolher"})); expect(screen.getByRole("button", {name:"Expandir"})).toBeTruthy();
});

it("padroniza o nome da unidade nos valores e nas opções", async () => {
 const {unitOptionLabel, friendlyParameterValue} = await import("./parameters");
 for (const unit of ["scv", "ame", "ame-jales", "ame-santa-fe", "sansaude", "nas"]) {
   expect(friendlyParameterValue("unidade", unit)).toBe(unitOptionLabel("unidade", unit, unit));
 }
 expect(unitOptionLabel("unidade", "scv", "Sansaúde")).toBe("SCV");
});

it("mostra parâmetro obrigatório e impede envio sem valor", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => ({parameter_schema: {paciente: {type:"string", label:"Paciente", required:true}}})}));
 try {
  mount(); Element.prototype.scrollIntoView = vi.fn();
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", {name: /Agenda · agenda · #1/}));
  expect(await screen.findByText("Paciente * (obrigatório)")).toBeTruthy();
  fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
  expect(screen.getByRole("alert").textContent).toContain("Informe paciente");
 } finally { vi.unstubAllGlobals(); }
});
