import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BlockFrame from "./stage/BlockFrame";
import type { BlockFrameProps } from "./stage/BlockFrame";
import TablePreview from "./blocks/TablePreview";
import { displayCanvasValue } from "./common/displayValue";
const props: BlockFrameProps = {block:{id:"title",type:"text",text:"{{report_name}}",x:0,y:0,width:400,height:80},background:"#ffffff",sources:[],assets:[],assetUrls:{},availableSources:[],localDatasets:new Map(),reportName:"Relatório real",showSampleData:false,isSelected:false,isDragging:false,onStartDrag:()=>{},onStartResize:()=>{},onFocusBlock:()=>{}};
describe("Tarefa 12: origem e valores na Prévia",()=>{
 it("identifica texto do relatório sem rotular como exemplo",()=>{
  const html=renderToStaticMarkup(<BlockFrame {...props}/>);
  expect(html).toContain("Texto do relatório");
  expect(html).toContain("Relatório real");
  expect(html).not.toContain("Exemplo");
  expect(renderToStaticMarkup(<BlockFrame {...props} showSampleData/>)).toContain("Exemplo");
 });
 it.each([
  ["2026-09-28T00:00:00","28/09/2026"],
  ["2026-09-28","28/09/2026"],
  ["2026-09-28T00:00:00.000Z","28/09/2026"],
  ["2026-09-28T14:35:09-03:00","28/09/2026 14:35"],
  ["2026-09-28 08:15","28/09/2026 08:15"],
  ["2026-02-30","2026-02-30"],
  ["2026-09-28T25:00:00","2026-09-28T25:00:00"],
  [null,"—"],[undefined,"—"],["","—"],["  ","—"],[0,"0"],[false,"false"],
  ["28/09/2026","28/09/2026"],
 ])("formata %s sem deslocar a data da fonte",(value,expected)=>expect(displayCanvasValue(value)).toBe(expected));
 it("mapeia colunas pelo nome mesmo reordenadas, preserva valores e explicita vazios",()=>{
  const html=renderToStaticMarkup(<TablePreview block={{...props.block,type:"table",options:{columns:["Responsável","Data","Resultado"]}}} source={{id:"s",type:"report",report_id:6}} dataset={{columns:["Data","Resultado","Responsável"],rows:[["2026-09-28T00:00:00",null,""],["2026-09-29T13:00:00","confirmed","Operador QA"]]}} fontSize={10} primaryColor="#075b94" axisColor="#526980" showSampleData={false}/>);
  expect(html).toContain("<td>—</td><td>28/09/2026</td><td>—</td>");
  expect(html).toContain("<td>Operador QA</td><td>29/09/2026 13:00</td><td>Confirmado</td>");
 });
});
