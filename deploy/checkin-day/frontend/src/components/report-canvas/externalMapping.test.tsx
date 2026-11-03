import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import TablePreview from "./blocks/TablePreview";
import {normalizeLayout,sanitizeLayoutForApi} from "./model";

describe("Contratos de fontes externas",()=>{
 it("preserva cabeçalhos dinâmicos ao abrir e salvar o Canvas",()=>{
  const layout=normalizeLayout({schema_version:1,page:{width:800,height:600,columns:24,background:"#ffffff"},sources:[{id:"s",type:"report",report_id:9}],pages:[{id:"p",name:"QA",blocks:[{id:"b",type:"table",source_id:"s",x:0,y:0,width:500,height:300,options:{columns:["V"],header_fields:{V:"T"}}}]}]});
  expect(sanitizeLayoutForApi(layout).pages[0].blocks[0].options?.header_fields).toEqual({V:"T"});
 });
 it("mostra o período retornado sem alterar o campo que vincula o valor",()=>{
  const html=renderToStaticMarkup(<TablePreview block={{id:"b",type:"table",x:0,y:0,width:500,height:300,options:{columns:["V"],header_fields:{V:"T"}}}} source={{id:"s",type:"report",report_id:9}} dataset={{columns:["V","T"],rows:[[25,"out/26"]]}} fontSize={12} primaryColor="#262626" axisColor="#595959" showSampleData={false}/>);
  expect(html).toContain("out/26");expect(html).toContain("25");
 });
});
