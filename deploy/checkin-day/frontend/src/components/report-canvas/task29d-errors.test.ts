import { expect, it } from "vitest";
import { canvasErrorMessage } from "./common/errorMessage";
import { friendlySourceName, friendlySourceError } from "./data/sourceName";
import { getSourceDisplayMeta } from "./inspector/inspectorOps";
import { computeCanvasProblems } from "./shell/problems";
import { createDefaultLayout } from "./model";
import type { CanvasSource } from "./model";
const tokens = ["contacts", "not-sent", "confirmed", "ame", "appointment", "start", "end", "unidade", "tipo_envio"];
it.each(tokens)("traduz %s em erros simples, listas e campos aninhados", token => {
  for (const data of [token, [token], {errors: {field: [token]}}, {detail: token, source_id: "dados", code:"raw_code"}]) {
    const text=canvasErrorMessage(data);
    expect(text).not.toMatch(new RegExp(`\\b${token}\\b`));
    expect(text).not.toMatch(/raw_code|source_id|\[object Object\]/);
  }
});
it("remove sufixo legado e reconhece identificadores sem depender das aspas", () => {
  const source: CanvasSource={id:"dados",type:"report",report_id:6};
  for (const label of ["dados", ...tokens]) expect(friendlySourceName({...source,label})).toBe("Tabela principal");
  for (const message of ['Fonte "dados" › Dados', "Fonte 'dados'", "Fonte dados", "Fonte (dados)"]) expect(friendlySourceError(message, source)).not.toMatch(/\bdados\b|› Dados/i);
});
it("mantém o parâmetro inexistente entre aspas e traduz os disponíveis", () => {
 expect(canvasErrorMessage({detail:'Parâmetro inexistente "foo". Disponíveis: start, end.'})).toBe('Parâmetro inexistente "foo". Disponíveis: Data inicial, Data final.');
});
it("ignora metadados técnicos e preserva linha e coluna na mensagem", () => {
 expect(canvasErrorMessage({detail:"Esquema inválido, linha 2, coluna 4",line:2,column:4,source_id:"dados",code:"contacts"})).toBe("Esquema inválido, linha 2, coluna 4");
 expect(canvasErrorMessage(null)).toContain("Confira os campos");
});

it("usa o nome da fonte do corpo também para identificadores personalizados", () => {
 expect(canvasErrorMessage({detail:"Fonte fonte_tecnica: falha"},{layout:{sources:[{id:"fonte_tecnica",label:"Consultas › Dados"}]}})).toBe("Fonte Consultas: falha");
 expect(canvasErrorMessage({detail:"This field is required."})).toContain("Confira os campos");
});

it("usa nomes amigáveis no inspetor e não imprime identificadores em fonte removida", () => {
 const source: CanvasSource={id:"dados",type:"report",report_id:6,dataset:"dados"};
 const meta=getSourceDisplayMeta(source,[{id:6,name:"Agendamentos confirmados",code:"confirmed",columns:[],datasets:[{id:"dados",name:"Dados",columns:[]}]}]);
 expect(meta.title).toBe("Agendamentos confirmados");expect(meta.subtitle).toBe("Agendamentos confirmados");
 const layout=createDefaultLayout();layout.pages[0].blocks=[{id:"b",type:"table",title:"Tabela",source_id:"contacts",x:0,y:0,width:200,height:200}];
 expect(JSON.stringify(computeCanvasProblems({layout,enabled:false,availableSources:[]}).items.map(p=>p.message))).not.toMatch(/contacts|› Dados/);
});

it("preserva o nome entre aspas no formato real do motor", () => {
 expect(canvasErrorMessage('O parâmetro "contacts" não existe nesta fonte. Parâmetros disponíveis: start.')).toBe('O parâmetro "contacts" não existe nesta fonte. Parâmetros disponíveis: Data inicial.');
});
it.each([["start","Data inicial"],["end","Data final"],["unidade","Unidade"],["tipo_envio","Tipo de envio"]])("usa rótulo português para filtro obrigatório %s", async (name,label) => {
 const {findMissingRequiredParameter}=await import("./api/useSourcePreview");
 expect(findMissingRequiredParameter({[name]:{required:true}},{})).toEqual({name,label});
});

it.each([401,403,404,429,500,502,504])("mantém erro HTTP %s em português sem texto técnico do backend", status => {
 const message=canvasErrorMessage({detail:"Authentication credentials were not provided. contacts",source_id:"dados"},undefined,status);
 expect(message).not.toMatch(/Authentication|contacts|dados/);expect(message.length).toBeGreaterThan(20);
});
