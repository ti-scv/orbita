import { describe, expect, it } from "vitest";
import { previewParameters, expandedPreviewParameters, previewPeriod } from "./hooks/useStagePreviews";
import { collectTestParameters } from "./parameters";
import type { CanvasSource } from "./model";
const source: CanvasSource = {id:"s",type:"report",report_id:6};
const now = new Date(2026,9,27,12);
describe("Tarefa 11: padrões temporários", () => {
  it("consulta datas e unidade sem precisar editar a fonte", () => {
    const schema = {end:"date",start:"date",unit:{type:"string"},filter:{type:"string",required:false}};
    const result = previewParameters(source,schema,{},"ame",now);
    expect(collectTestParameters(result.fields,result.values)).toEqual({start:"2026-09-27",end:"2026-10-27",unit:"ame"});
    expect(previewPeriod(result.fields,result.values)).toBe("27/09 a 27/10");
    const declared = previewParameters({...source,parameters:{start:""}},{start:{type:"date",default:"2026-10-01"}},{},"ame",now);
    expect(declared.values.start).toBe("01/10/2026");
    expect(source).toEqual({id:"s",type:"report",report_id:6});
    expect(expandedPreviewParameters(result.fields,result.values,now)).toEqual({start:"2026-07-29",end:"2026-10-27",unit:"ame"});
  });
  it("preserva valores declarados, inclusive zero e false", () => {
    const result=previewParameters({...source,parameters:{start:{parameter:"from"},count:0,flag:false}},
      {start:"date",end:{type:"date",default:"2026-10-20"},count:"integer",flag:"boolean",filter:{default:"todos"}},
      {from:{default:"2026-10-01"}},"ame",now);
    expect(result.values).toEqual({start:"01/10/2026",end:"20/10/2026",count:"0",flag:"false",filter:"todos"});
  });
  it("atravessa mês e ano corretamente e mantém filtro obrigatório desconhecido pendente", () => {
    const result=previewParameters(source,{start:"date",end:"date",doctor:{type:"string"}},{},"ame",new Date(2026,0,10,12));
    expect(result.values.start).toBe("11/12/2025");
    expect(result.values.end).toBe("10/01/2026");
    expect(()=>collectTestParameters(result.fields,result.values)).toThrow(/doctor/);
  });
});
