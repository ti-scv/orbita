import { describe, expect, it } from "vitest";
import { matchingRole, templatePermissions } from "./components/UserDirectory";
import { readRoute } from "./routes";

const sections = Object.fromEntries(["overview", "messages", "groups", "issues", "settings", "reports", "reportWhatsApp", "users"].map(key => [key, key]));
const role: import("./components/PermissionRoles").PermissionRole = { id: 1, name: "Equipe", permissions: { messages: "read", settings: "none", reports: "write", reportWhatsApp: "read" } };
describe("tipos de usuário", () => {
  it("reconhece apenas a correspondência completa e única", () => {
    const permissions = templatePermissions(role, sections);
    const grant = { unit: "ame", role: "operator", permissions };
    expect(matchingRole(grant, [role], sections)?.name).toBe("Equipe");
    expect(matchingRole(grant, [role, {...role, id: 2}], sections)).toBeUndefined();
    expect(matchingRole({...grant, permissions: {...permissions, users: "read"}}, [role], sections)).toBeUndefined();
    expect(permissions.groups).toBe("read");
    expect(permissions.users).toBe("none");
  });
});
describe("rotas", () => {
  it("distingue rotas desconhecidas de rotas conhecidas", () => {
    expect(readRoute("/configuracoes").notFound).toBe(false);
    expect(readRoute("/relatorios/123/canvas").notFound).toBe(false);
    expect(readRoute("/nao-existe").notFound).toBe(true);
  });
});

