import { describe, it, expect } from "vitest";
import { canAccess, canUseReportWhatsApp, permissionsFor, reconcileSession } from "./permissions";
import type { Session } from "./types";

const session:Session={username:"operator",mode:"simulated",units:[{id:1,slug:"ame",name:"AME",paused:true,response_hours:24}],roles:{ame:"operator"},permissions:{ame:{appointments:"write",groups:"read",messages:"none"}}};
describe("Explicit sidebar grants",()=>{
  it("shows only selected sections and preserves read-only groups",()=>{
    expect(canAccess(session,"ame","appointments",true)).toBe(true);
    expect(canAccess(session,"ame","groups")).toBe(true);
    expect(canAccess(session,"ame","groups",true)).toBe(false);
    expect(canAccess(session,"ame","messages")).toBe(false);
    expect(canAccess(session,"ame","users")).toBe(false);
  });
  it("rejects withdrawn units even when a cached role exists",()=>{
    expect(canAccess({...session,units:[]},"ame","appointments")).toBe(false);
    expect(Object.values(permissionsFor(session,"other")).every(x=>x==="none")).toBe(true);
  });
});

describe("Session polling", () => {
  it("keeps the same session when polling returns unchanged data", () => {
    expect(reconcileSession(session, JSON.parse(JSON.stringify(session)))).toBe(session);
  });
  it("applies changed permissions immediately", () => {
    const next = {...session, permissions: {ame: {...session.permissions?.ame, appointments: "none" as const}}};
    const result = reconcileSession(session, next);
    expect(result).toBe(next);
    expect(canAccess(result, "ame", "appointments")).toBe(false);
  });
  it("applies revoked units", () => {
    const next = {...session, units: []};
    expect(reconcileSession(session, next)).toBe(next);
    expect(canAccess(reconcileSession(session, next), "ame", "appointments")).toBe(false);
  });
  it("applies changes to the send mode", () => {
    const next = {...session, mode: "meta_test"};
    expect(reconcileSession(session, next)).toBe(next);
  });
});


describe("Meta costs",()=>{
  it("denies by default for operators and accepts explicit read grants",()=>{
    const local={...session,permissions:undefined};
    expect(canAccess(local,"ame","costs")).toBe(false);
    const grant={...session,permissions:{ame:{costs:"read" as const}}};
    expect(canAccess(grant,"ame","costs")).toBe(true);
    expect(canAccess(grant,"ame","costs",true)).toBe(false);
  });
  it("revoked units cannot read costs",()=>{
    expect(canAccess({...session,units:[],permissions:{ame:{costs:"read"}}},"ame","costs")).toBe(false);
  });
});

describe("Permissões da tarefa 35", () => {
  const base = {...session, permissions: {ame: {overview:"none" as const, messages:"none" as const, groups:"none" as const, issues:"none" as const, settings:"none" as const, users:"none" as const, operationsAdmin:"none" as const, reports:"none" as const, reportWhatsApp:"none" as const}}};
  for (const page of ["overview", "messages", "groups", "issues", "settings", "reports"] as const) {
    it(`exige acesso para ${page}`, () => {
      expect(canAccess(base, "ame", page)).toBe(false);
      const granted = {...base, permissions: {ame: {...base.permissions.ame, [page]: "read" as const}}};
      expect(canAccess(granted, "ame", page)).toBe(true);
      expect(canAccess(granted, "ame", page, true)).toBe(false);
    });
  }
  it("mantém WhatsApp independente de relatórios e distingue leitura de edição", () => {
    expect(canUseReportWhatsApp(base, "ame")).toBe(false);
    const reports = {...base, permissions: {ame: {...base.permissions.ame, reports:"write" as const}}};
    expect(canUseReportWhatsApp(reports, "ame")).toBe(false);
    const read = {...base, permissions: {ame: {...base.permissions.ame, reportWhatsApp:"read" as const}}};
    expect(canUseReportWhatsApp(read, "ame")).toBe(true);
    expect(canUseReportWhatsApp(read, "ame", true)).toBe(false);
    expect(canAccess(read, "ame", "reports")).toBe(true);
    const write = {...base, permissions: {ame: {...base.permissions.ame, reportWhatsApp:"write" as const}}};
    expect(canUseReportWhatsApp(write, "ame", true)).toBe(true);
    expect(canUseReportWhatsApp({...write, units:[]}, "ame")).toBe(false);
  });
});


describe("Autoagendamento Sansaúde", () => {
  const units = [...session.units, {id: 2, slug: "sansaude", name: "Sansaúde", paused: false, response_hours: 24}];
  it("permite admin e operador autorizado somente na unidade correta", () => {
    for (const role of ["admin", "operator"]) {
      const granted = {...session, units, roles: {...session.roles, sansaude: role}, permissions: {ame: {autoagenda: "write" as const}, sansaude: {autoagenda: "write" as const}}};
      expect(canAccess(granted, "sansaude", "autoagenda", true)).toBe(true);
      expect(canAccess(granted, "ame", "autoagenda")).toBe(false);
      expect(canAccess({...granted, permissions: {sansaude: {autoagenda: "none"}}}, "sansaude", "autoagenda")).toBe(false);
    }
  });
});
