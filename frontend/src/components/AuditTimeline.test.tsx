// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditTimeline } from "./AuditTimeline";
import { syncCounts } from "./syncCounts";
describe("Registro de auditoria", () => {
 it("mostra ações, metadados e decisão em português e oculta códigos desconhecidos", () => {
  const base = {actor_name: "admin", object_id: "1", created_at: "data"};
  render(<AuditTimeline dateTime={v => v} items={[
   {...base, id: 1, action: "user_sync.released", details: {login: "ana", unit: "Filial", access: [{unit:"Mãe", role:"operator", type:"Enfermagem"}]}},
   {...base, id: 2, action: "user_sync.completed", details: {unit:"Filial", new:1, updated:2, removed:0, conflicts:1}},
   {...base, id: 3, action: "user_sync.conflict_resolved", details: {login:"ana", new_login:"ana2", decision:"separate"}},
   {...base, id: 4, action: "user.access_configured", details: {login:"ana"}},
   {...base, id: 5, action: "other.raw", details: {}}
  ]}/>);
  expect(screen.getByText("Usuário sincronizado liberado")).toBeTruthy();
  expect(screen.getByText(/Usuário: ana; Unidade de origem: Filial; Acesso: Mãe · Operador · Enfermagem/)).toBeTruthy();
  expect(screen.getByText(/1 novo, 2 atualizados, 0 removidos, 1 conflito/)).toBeTruthy();
  expect(screen.getByText(/Decisão: criar conta separada/)).toBeTruthy();
  expect(screen.getByText("Acesso de usuário configurado")).toBeTruthy();
  expect(screen.getByText("Atividade registrada")).toBeTruthy();
  expect(screen.queryByText("other.raw")).toBeNull();
 });
 it("flexiona todas as contagens", () => {
  expect(syncCounts({new:1, updated:1, removed:1, conflicts:2})).toBe("1 novo, 1 atualizado, 1 removido, 2 conflitos");
 });
});
