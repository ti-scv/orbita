// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {useState} from "react";
import SourceDialog from "./data/SourceDialog";
import DataDrawer from "./data/DataDrawer";
import {createSourceModalState} from "./data/sourceOps";
import {friendlyParameterName} from "./parameters";
import {canvasErrorMessage} from "./common/errorMessage";
import {isDraftDifferent} from "./state/draftRecovery";
import {normalizeLayout} from "./model";
import {previewParameters} from "./hooks/useStagePreviews";
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
const catalog = [
 {id:57,name:"Mesmo nome",code:"legacy123-47",establishment:"AME Votuporanga"},
 {id:58,name:"Mesmo nome",code:"legacy123-48",establishment:"AME Votuporanga",available:false},
 {id:59,name:"Outro",code:"confirmed",establishment:"AME Jales"},
];
function mount(){const init=createSourceModalState([],catalog); if(!init.ok) throw Error(init.error); const initialState=init.state; function App(){const [state,setState]=useState(initialState); return <SourceDialog sourceModal={state} onChange={setState} availableSources={catalog} reportId={57} unit="scv" sourceEstablishment="AME Votuporanga" onClose={()=>{}} onSubmit={e=>e.preventDefault()}/>}; render(<App/>);}
it("filtra estabelecimentos, identifica duplicados e revela outros sob demanda",()=>{Element.prototype.scrollIntoView=vi.fn(); mount(); fireEvent.click(screen.getByRole("combobox")); expect(screen.getByRole("option",{name:/Mesmo nome · AME Votuporanga · ID 58 · Em revisão/})).toBeTruthy(); expect(screen.queryByRole("option",{name:/Outro/})).toBeNull(); fireEvent.keyDown(screen.getByRole("listbox"),{key:"Escape"}); fireEvent.click(screen.getByLabelText("Mostrar outros estabelecimentos")); fireEvent.click(screen.getByRole("combobox")); expect(screen.getByRole("option",{name:/Outro · AME Jales · ID 59/})).toBeTruthy();});
it("traduz nomes e erro",()=>{expect(friendlyParameterName("cd_paciente")).toBe("Código do paciente"); expect(canvasErrorMessage("Fonte indisponível nesta Unidade.")).toBe("Esta fonte não está disponível para esta unidade.");});
it("fecha gaveta com Esc e respeita modal superior",()=>{const close=vi.fn(); render(<DataDrawer source={{id:"s",type:"inline",columns:["Responsável"],rows:[[""]]}} preview={{columns:[{name:"Responsável",type:"text",estimated:true}],rows:[[""]],total_rows:1,truncated:false}} onClose={close}/>); expect(screen.getByText("Sem valores neste período")).toBeTruthy(); expect(screen.getByLabelText(/estimado pelo esquema/)).toBeTruthy(); const modal=document.createElement("div"); modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); document.body.appendChild(modal); fireEvent.keyDown(document,{key:"Escape"}); expect(close).not.toHaveBeenCalled(); modal.remove(); fireEvent.keyDown(document,{key:"Escape"}); expect(close).toHaveBeenCalledOnce();});
it("não identifica rascunho idêntico como alteração",()=>{const layout=normalizeLayout({}); const current={layout,enabled:false,outputFormat:"pdf" as const}; expect(isDraftDifferent({...current,timestamp:Date.now()},current)).toBe(false); expect(isDraftDifferent({...current,enabled:true,timestamp:Date.now()},current)).toBe(true);});

it("carrega a prévia ao preencher campo obrigatório e permite recarregar", async()=>{
 Element.prototype.scrollIntoView=vi.fn();
 const fetchMock=vi.fn().mockImplementation(async (_url, options)=>({ok:true,status:200,json:async()=> options.method === "POST" ? {columns:[{name:"Responsável",type:"text",estimated:true}],rows:[],total_rows:0,truncated:false} : {parameter_schema:{paciente:{type:"string",label:"Paciente",required:true}}}}));
 vi.stubGlobal("fetch",fetchMock); mount(); fireEvent.click(screen.getByRole("combobox")); fireEvent.click(screen.getByRole("option",{name:/Mesmo nome · AME Votuporanga · ID 57/}));
 const input=await screen.findByLabelText(/Paciente/); expect(fetchMock.mock.calls.filter(call=>call[1].method === "POST")).toHaveLength(0);
 fireEvent.change(input,{target:{value:"Ana"}}); await waitFor(()=>expect(screen.getByText(/A consulta funcionou, mas não trouxe nenhuma linha/)).toBeTruthy(),{timeout:3000});
 expect(screen.getByLabelText(/estimado pelo esquema/)).toBeTruthy(); fireEvent.click(screen.getByRole("button",{name:"Recarregar"})); await waitFor(()=>expect(fetchMock.mock.calls.filter(call=>call[1].method === "POST").length).toBe(2));
});

it("prefere a unidade do relatório quando permitida",()=>{
 const source={id:"s",type:"report" as const,report_id:1};
 const schema={unidade:{type:"string",default:"ame",options:["ame","scv"]}};
 expect(previewParameters(source,schema,{},"scv",new Date(),true).values.unidade).toBe("scv");
 expect(previewParameters(source,{unidade:{type:"string",default:"ame-jales",options:["ame", "ame-jales"]}}, {},"scv",new Date(),true,"ame").values.unidade).toBe("ame");
});
it("ignora a ordem das propriedades de um rascunho",()=>{
 const layout=normalizeLayout({}); const reordered=JSON.parse(JSON.stringify(layout, (_key,value)=>value && !Array.isArray(value) && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse()) : value));
 expect(isDraftDifferent({layout:reordered,enabled:false,outputFormat:"pdf",timestamp:Date.now()},{layout,enabled:false,outputFormat:"pdf"})).toBe(false);
});
it("devolve o foco ao botão que abriu a gaveta",()=>{
 function App(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Ver dados</button>{open && <DataDrawer source={{id:"s",type:"inline",columns:["Nome"],rows:[]}} preview={null} onClose={()=>setOpen(false)}/>}</>}
 render(<App/>); const trigger=screen.getByRole("button",{name:"Ver dados"});trigger.focus();fireEvent.click(trigger);fireEvent.keyDown(document,{key:"Escape"});expect(document.activeElement).toBe(trigger);
});

it("remove opções repetidas por valor e prefere a unidade permitida", async()=>{
 const {testParameters} = await import("./parameters");
 const schema={unidade:{type:"string",default:"ame",choices:[{value:"ame",label:"AME Votuporanga"},{value:"ame",label:"AME Votuporanga"},{value:"scv",label:"SCV"}]}};
 expect(testParameters(schema)[0].options?.map(o=>o.value)).toEqual(["ame","scv"]);
 const source={id:"s",type:"report" as const,report_id:1};
 expect(previewParameters(source,schema,{},"scv",new Date(),true).values.unidade).toBe("scv");
});

it("permite buscar relatórios por nome mesmo com poucas opções",()=>{Element.prototype.scrollIntoView=vi.fn(); mount(); fireEvent.click(screen.getByRole("combobox")); fireEvent.change(screen.getByRole("combobox",{name:/Buscar em/}),{target:{value:"Mesmo nome"}}); expect(screen.getByRole("option",{name:/Mesmo nome/})).toBeTruthy(); expect(screen.queryByRole("option",{name:/Outro/})).toBeNull();});
