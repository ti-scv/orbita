// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import CheckInWorkspace from "./CheckInWorkspace";
import {request} from "../api";
import {canAccess} from "../permissions";
import {readRoute, routePath} from "../routes";
import type {Session} from "../types";
vi.mock("../api",()=>({query:(path:string, filters:Record<string,string>)=>"/api/v1/"+path+"/?"+new URLSearchParams(filters),request:vi.fn()}));
const config = {enabled:false,booking_enabled:false,appointment_enabled:false,oracle_enabled:false,channel:"meta",timezone:"America/Sao_Paulo",weekdays:[0,1,2,3,4],business_start:"08:00:00",business_end:"18:00:00",holidays:[],lead_value:24,lead_unit:"hours"};
const row = {id:1,appointment:2,booking:null,source_revision:1,cycle:1,scheduled_at:"2026-11-10T12:00:00Z",planned_send_at:null,sent_at:null,response_deadline:null,responded_at:null,attendance_checked_at:null,response:"confirmed",attendance:"absent",version:2};
beforeEach(()=>{vi.mocked(request).mockImplementation(async (url,method) => {
  if(url.includes("checkin-configuration")) return config as never;
  if(url.includes("transition") && method==="POST") return {} as never;
  if(url.includes("checkins/1/")) return row as never;
  return {results:[row],count:1,next:null} as never;
})});
afterEach(()=>{cleanup();vi.resetAllMocks()});
describe("Check-in",()=>{
  vi.setConfig({testTimeout:30000});
  it("limita rota e permissão à Sansaúde e respeita leitura e escrita",()=>{
    const session={units:[{slug:"sansaude"},{slug:"ame"}],roles:{sansaude:"viewer",ame:"admin"},permissions:{sansaude:{checkin:"read"},ame:{checkin:"write"}}} as unknown as Session;
    expect(readRoute("/check-in").page).toBe("checkin");expect(routePath("checkin")).toBe("/check-in");
    expect(canAccess(session,"sansaude","checkin")).toBe(true);expect(canAccess(session,"sansaude","checkin",true)).toBe(false);expect(canAccess(session,"ame","checkin")).toBe(false);
  });
  it("mostra as dimensões e oculta controles de escrita",async()=>{
    render(<CheckInWorkspace unit="sansaude" write={false}/>);
    expect(await screen.findByText("Não compareceu")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("Confirmado")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"Configurar"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Detalhes"}));
    expect(await screen.findByRole("dialog",{name:"Detalhes do check-in"})).toBeTruthy();
    expect(screen.queryByRole("button",{name:"Registrar alteração"})).toBeNull();
  });
  it("salva configuração somente após confirmação no modal",async()=>{
    render(<CheckInWorkspace unit="sansaude" write/>);
    const button=await screen.findByRole("button",{name:"Configurar"}); await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);fireEvent.click(screen.getByLabelText("Ativar check-in"));
    expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="PATCH")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
    await waitFor(()=>expect(vi.mocked(request).mock.calls.some(c=>c[1]==="PATCH" && (c[2] as typeof config).enabled)).toBe(true));
    await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("mantém modal aberto e mostra conflito",async()=>{
    vi.mocked(request).mockImplementation(async (url,method)=>{
      if(method==="POST") throw Object.assign(new Error("conflito"),{status:409});
      if(url.includes("checkin-configuration"))return config as never;
      if(url.includes("checkins/1/"))return row as never;
      return {results:[row],count:1,next:null} as never;
    });
    render(<CheckInWorkspace unit="sansaude" write/>);
    fireEvent.click(await screen.findByRole("button",{name:"Detalhes"}));
    fireEvent.click(await screen.findByRole("button",{name:"Registrar alteração"}));
    fireEvent.change(within(screen.getByRole("dialog", {name:"Registrar alteração"})).getByLabelText("Resposta"),{target:{value:"confirmed"}});
    fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Correção"}});
    fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
    expect(await screen.findByText(/dados foram alterados/)).toBeTruthy();expect(screen.getByRole("dialog",{name:"Registrar alteração"})).toBeTruthy();
  });
});
