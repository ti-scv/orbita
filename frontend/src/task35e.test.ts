import { describe, expect, it } from "vitest";
import { limitRemoteGrant, templatePermissions } from "./components/UserDirectory";

describe("limites de acesso remoto", () => {
  it("limita relatório e WhatsApp e mantém o tipo local independente", () => {
    const grant = {unit:"remote:1", role:"admin", permissions:{messages:"read", reports:"write", reportWhatsApp:"read"} as const};
    const option = {slug:"remote:1", name:"Remota", remote:true, editable:true, max_role:"operator", permissions:{messages:"read", reports:"read", reportWhatsApp:"none"} as const};
    expect(limitRemoteGrant(grant, option)).toMatchObject({role:"operator", permissions:{messages:"read", reports:"read", reportWhatsApp:"none"}});
    expect(templatePermissions({id:1, name:"QA", permissions:{messages:"read", settings:"none", reports:"write", reportWhatsApp:"read"}}, {overview:"Visão geral",messages:"Mensagens",groups:"Grupos",issues:"Pendências",reports:"Relatórios",reportWhatsApp:"WhatsApp"})).toMatchObject({overview:"read", groups:"read", issues:"read", reports:"write", reportWhatsApp:"read"});
  });
});
