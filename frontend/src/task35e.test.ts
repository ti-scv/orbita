import { describe, expect, it } from "vitest";
import { applyTypeToGrants, limitRemoteGrant, templatePermissions } from "./components/UserDirectory";

describe("limites de acesso remoto", () => {
  it("limita relatório e WhatsApp e mantém o tipo local independente", () => {
    const grant = {unit:"remote:1", role:"admin", permissions:{messages:"read", reports:"write", reportWhatsApp:"read"} as const};
    const option = {slug:"remote:1", name:"Remota", remote:true, editable:true, max_role:"operator", permissions:{messages:"read", reports:"read", reportWhatsApp:"none"} as const};
    expect(limitRemoteGrant(grant, option)).toMatchObject({role:"operator", permissions:{messages:"read", reports:"read", reportWhatsApp:"none"}});
    expect(templatePermissions({id:1, name:"QA", permissions:{messages:"read", settings:"none", reports:"write", reportWhatsApp:"read"}}, {overview:"Visão geral",messages:"Mensagens",groups:"Grupos",issues:"Pendências",reports:"Relatórios",reportWhatsApp:"WhatsApp"})).toMatchObject({overview:"read", groups:"read", issues:"read", reports:"write", reportWhatsApp:"read"});
  });
});

it("aplica o tipo às unidades remotas associadas para que o servidor informe os limites", () => {
  const local = {slug:"ame", name:"AME", remote:false, editable:true, max_role:"admin", permissions:{} as const};
  const remote = {slug:"remote:1", name:"Remota", remote:true, local_unit:"ame", editable:true, max_role:"admin", permissions:{reports:"read", reportWhatsApp:"none"} as const};
  const other = {...remote, slug:"remote:2", local_unit:"outra"};
  const grants = [local, remote, other].map(o => ({unit:o.slug, role:"admin", permissions:{reports:"none", reportWhatsApp:"none"} as const}));
  const type = {id:1, name:"QA", permissions:{messages:"none", settings:"none", reports:"write", reportWhatsApp:"read"} as const};
  const result = applyTypeToGrants(grants, local, [local, remote, other], type, {reports:"Relatórios", reportWhatsApp:"WhatsApp"});
  expect(result[1].permissions).toEqual({reports:"write", reportWhatsApp:"read"});
  expect(limitRemoteGrant(result[1], remote).permissions).toEqual({reports:"read", reportWhatsApp:"none"});
  expect(result[2]).toEqual(grants[2]);
});
