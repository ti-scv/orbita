// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DataPanel from "./data/DataPanel";
import ColumnSelect from "./inspector/fields/ColumnSelect";
import LeftRail from "./shell/LeftRail";
import { useShellLayoutPrefs } from "./shell/useShellLayoutPrefs";
import type { CanvasSource, SourcePreview } from "./model";

afterEach(() => { cleanup(); localStorage.clear(); });
function Shell() {
  const prefs = useShellLayoutPrefs();
  return <><button onClick={prefs.closeLeftPanel}>Recolher painel</button><LeftRail {...prefs} onSelectLibrary={prefs.selectLibrary} onOpenTab={prefs.openLeftPanel} onCloseLeftPanel={prefs.closeLeftPanel}><span>{prefs.libraryTab}</span></LeftRail></>;
}
it("abre Dados no primeiro clique, mantém a seleção repetida e reabre após recolher", () => {
  render(<Shell />);
  const data = screen.getByRole("tab", {name: "Dados"});
  for (const action of [() => {}, () => {}, () => fireEvent.click(screen.getByRole("button", {name:"Recolher painel"})), () => fireEvent.click(screen.getByRole("tab", {name:"Imagens"}))]) {
    action(); fireEvent.click(data);
    expect(data.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("data");
    expect(localStorage.getItem("scv.canvas.left")).toBe("true");
  }
});
it("seleciona Dados pelo teclado e o clique seguinte mantém o painel aberto", () => {
  render(<Shell />);
  const add=screen.getByRole("tab", {name:"Adicionar"});
  fireEvent.keyDown(add, {key:"ArrowDown"});
  fireEvent.keyDown(document.activeElement!, {key:"ArrowDown"});
  const data=screen.getByRole("tab", {name:"Dados"});
  expect(document.activeElement).toBe(data);
  fireEvent.click(data);
  expect(data.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel").textContent).toBe("data");
});
it("abre Dados no primeiro clique com a preferência de painel fechado", () => {
  localStorage.setItem("scv.canvas.left", "false"); render(<Shell />);
  expect(screen.queryByRole("tabpanel")).toBeNull();
  fireEvent.click(screen.getByRole("tab", {name:"Dados"}));
  expect(screen.getByRole("tabpanel").textContent).toBe("data");
});
const source: CanvasSource = {id:"s",type:"report",report_id:6,label:"Fonte QA"};
const preview: SourcePreview = {columns:[
  {name:"Data",type:"date",sample:["2026-09-21 00:00:00"]},
  {name:"Hora",type:"datetime",sample:["2026-09-21 14:35:10"]},
  {name:"Zero",type:"number",sample:["0"]},
],rows:[],total_rows:0,truncated:false};
it("formata exemplos no painel de colunas em português e conserva zero", () => {
  render(<DataPanel active sources={[source]} availableSources={[]} stagePreviewStates={{s:{status:"ready",data:preview,error:null,loadedAt:null}}} onCreateSource={vi.fn()} onEditSource={vi.fn()} onRemoveSource={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{expanded:false}));
  const samples=Array.from(document.querySelectorAll(".cv-column-sample"));
  expect(samples.map(e=>e.textContent)).toEqual(["21/09/2026","21/09/2026 14:35","0"]);
  expect(samples.map(e=>e.getAttribute("title"))).toEqual(samples.map(e=>e.textContent));
});
it("formata datas também nas opções do seletor de colunas", () => {
  render(<ColumnSelect value="" columns={preview.columns} onChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole("combobox"));
  expect(Array.from(document.querySelectorAll(".cv-col-option-reason")).map(e=>e.textContent)).toEqual(["21/09/2026","21/09/2026 14:35","0"]);
});
