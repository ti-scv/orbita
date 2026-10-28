// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import frameSource from "./stage/BlockFrame.tsx?raw";
import pageSource from "../ReportCanvasPage.tsx?raw";
import topbarSource from "./shell/TopBar.tsx?raw";
import DataPanel from "./data/DataPanel";
import ShellSkeleton from "./shell/ShellSkeleton";
import { ThemeToggle } from "../ThemeToggle";
import { ThemeProvider } from "../../ThemeContext";
import { useStagePreviews } from "./hooks/useStagePreviews";
import { request } from "../../api";
import type { CanvasSource, SourcePreview } from "./model";
vi.mock("../../api", () => ({request: vi.fn(), query: (p: string) => p}));
afterEach(() => {cleanup(); vi.clearAllMocks();});
const source: CanvasSource = {id:"s",type:"report",report_id:6};
const preview: SourcePreview = {columns:[{name:"Nome",type:"text",nullable:false,null_count:0}],rows:[["Z"],["A"],["M"]],total_rows:3,truncated:false};
it("separa o carregamento da prévia do estilo de erro",()=>{
 const frame=frameSource;
 expect(frame).toContain('className="cv-block-status-inline" role="status">Carregando prévia…');
});
it("Ver dados preserva exatamente a resposta e ordem da prévia sem nova consulta",async()=>{
 render(<DataPanel active sources={[source]} availableSources={[]} stagePreviewStates={{s:{status:"ready",data:preview,error:null,loadedAt:new Date()}}} onLoadStagePreview={vi.fn()} onCreateSource={vi.fn()} onEditSource={vi.fn()} onRemoveSource={vi.fn()} />);
 fireEvent.click(screen.getByRole("button",{name:/Ver dados/}));
 expect(Array.from(document.querySelectorAll(".cv-data-drawer .cv-preview-table tbody tr")).map(e=>e.querySelector("td:last-child")?.textContent)).toEqual(["Z","A","M"]);
 expect(request).not.toHaveBeenCalled();
});
it("mostra mensagem visível durante a preparação do editor",()=>{
 render(<ShellSkeleton label="Carregando relatório…"/>);
 expect(screen.getByText(/Aguarde, preparando os dados/).closest('[aria-hidden="true"]')).toBeNull();
});
it("consulta configuração e metadados em paralelo na rota",()=>{
 const page=pageSource;
 expect(page).toMatch(/Promise.all\(\[\s*request<ReportSummary>[\s\S]*?request<CanvasGetResponse>/);
 expect(page).toContain("initialCanvas={initialCanvas}");
});
it("não consulta de novo o relatório quando a fonte é o próprio relatório",async()=>{
 vi.mocked(request).mockResolvedValue({...preview,elapsed_ms:1});
 function Harness(){const {states}=useStagePreviews(6,"ame",[source],true,{});return <span>{states.s?.status}</span>;}
 render(<Harness/>);await waitFor(()=>expect(screen.getByText("ready")).toBeTruthy());
 expect(request).toHaveBeenCalledTimes(1);expect(vi.mocked(request).mock.calls[0][0]).toContain("canvas-source-preview");
});
it("a lâmpada explica o próximo tema ao clicar",()=>{
 render(<ThemeProvider><ThemeToggle/></ThemeProvider>);
 expect(screen.getByRole("button",{name:/Mudar para tema (claro|escuro)/}).title).toMatch(/Mudar para tema/);
});
it("Publicação explica a abertura e o salvamento",()=>{
 const text=topbarSource;
 expect(text).toContain('aria-label="Publicação: abrir opções de ativação do modelo do relatório e formato de saída"');
 expect(text).toContain("As alterações são aplicadas ao salvar.");
});
