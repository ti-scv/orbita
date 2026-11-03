// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DataDrawer from "./data/DataDrawer";
import { OriginContext } from "./data/ColumnOrigin";
import { formatCellValue } from "./data/columnTypes";
vi.mock("./api/useSourcePreview", () => ({ fetchSourcePreviewRequest: vi.fn() }));
import { fetchSourcePreviewRequest } from "./api/useSourcePreview";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("alcança a linha 51 e volta à primeira página", async () => {
 const source = { id: "dados", type: "report" as const, report_id: 6, dataset: "Pacientes", label: "Atendimentos" };
 const columns = [{ name: "Paciente", type: "text" as const }];
 vi.mocked(fetchSourcePreviewRequest).mockResolvedValueOnce({ columns, rows: [["Paciente 51"]], total_rows: 51, truncated: false, has_more: false }).mockResolvedValueOnce({ columns, rows: [["Paciente 1"]], total_rows: 51, truncated: true, has_more: true, next_offset: 50 });
 render(<OriginContext.Provider value={{ reportId: 6, unit: "ame" }}><DataDrawer source={source} preview={{ columns, rows: Array.from({length:50}, (_, i) => [`Paciente ${i + 1}`]), total_rows: 51, truncated: true, has_more: true, next_offset: 50 }} onClose={() => {}} /></OriginContext.Provider>);
 fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
 await waitFor(() => expect(screen.getAllByText("Paciente 51", {selector:"td"})[0]).toBeTruthy());
 expect(fetchSourcePreviewRequest).toHaveBeenLastCalledWith(6, "ame", source, {}, 50, undefined, 50);
 expect((screen.getByRole("button", {name:"Próxima"}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole("button", {name:"Anterior"}));
 await waitFor(() => expect(fetchSourcePreviewRequest).toHaveBeenLastCalledWith(6, "ame", source, {}, 50, undefined, 0));
});
it("formata vazios, datas e estados conhecidos em português", () => {
 expect(formatCellValue("   ")).toBe("—");
 expect(formatCellValue("2026-09-21T00:00:00")).toBe("21/09/2026");
 expect(formatCellValue("2026-09-21T14:35:00")).toBe("21/09/2026 14:35");
 expect(formatCellValue("pending")).toBe("Pendente");
 expect(formatCellValue("open")).toBe("Aberto");
 expect(formatCellValue("outro")).toBe("outro");
});


it("mostra data brasileira e envia ISO na prévia", async () => {
 const { default: PreviewParameters } = await import("./blocks/PreviewParameters");
 const submit = vi.fn();
 render(<PreviewParameters fields={[{name:"start", label:"Data inicial", type:"date"}]} values={{start:"2026-10-01"}} onSubmit={submit} />);
 const input = screen.getByLabelText("Data inicial *") as HTMLInputElement;
 expect(input.value).toBe("01/10/2026");
 fireEvent.change(input, {target:{value:"15/11/2026"}});
 fireEvent.click(screen.getByRole("button", {name:"Tentar de novo"}));
 expect(submit).toHaveBeenCalledWith({start:"2026-11-15"});
});


it("formata contagens exatas, limitadas e estimadas", async () => {
 const { formatRowCount } = await import("./data/rowCount");
 expect(formatRowCount(50, {total_rows:187, total_rows_exact:true})).toBe("50 de 187 linhas");
 expect(formatRowCount(50, {total_rows:10000, total_rows_exact:false, total_rows_capped:true})).toBe("50 de mais de 10.000 linhas");
 expect(formatRowCount(50, {total_rows:51, total_rows_exact:false})).toBe("50 de pelo menos 51 linhas");
});
