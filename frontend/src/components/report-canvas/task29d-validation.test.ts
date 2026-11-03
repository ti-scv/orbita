import { afterEach, expect, it, vi } from "vitest";
import { validateCanvasRequest } from "./api/useCanvasApi";
import { createDefaultLayout } from "./model";
afterEach(()=>vi.unstubAllGlobals());
it("envia o contrato completo e preserva tipos e valores", async () => {
 const layout=createDefaultLayout();const text=JSON.stringify(layout);const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({layout})));vi.stubGlobal("fetch",fetcher);
 await expect(validateCanvasRequest(6,"ame",text,false,"pdf",[])).resolves.toEqual(layout);
 expect(fetcher.mock.calls[0][0]).toBe("/api/v1/reports/6/canvas-validate/?unit=ame");
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({json:text,enabled:false,output_format:"pdf",parameter_edits:[]});
});
it.each(["{","null","[]","{}",'{"pages":[],"sources":{}}'])("bloqueia envelope inválido: %s",async text=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 await expect(validateCanvasRequest(6,"ame",text,false,"pdf",[])).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
});
