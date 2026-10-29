import type { PageName, SectionPermissions, Session } from "./types";

export const sectionLabels: Record<string, string> = {
  costs: "Custos Meta", overview: "Visão geral", appointments: "Agendamentos", groups: "Grupos", messages: "Mensagens",
  issues: "Pendências", campaigns: "Importa CROSS", reports: "Relatórios",
  operationsAdmin: "Administração", settings: "Configurações", users: "Usuários", reportWhatsApp: "WhatsApp dos relatórios",
};
export function defaultPermissions(role: string): SectionPermissions {
  return Object.fromEntries(Object.keys(sectionLabels).map(section => [section,
    section === "reportWhatsApp" ? "none" : section === "costs" && role !== "admin" ? "none" : role === "admin" || (role === "operator" && !["settings", "operationsAdmin", "users"].includes(section)) ? "write" : section === "users" ? "none" : "read"]));
}
export function permissionsFor(session: Session, unit: string): SectionPermissions {
  if (!session.units.some(u=>u.slug===unit)) return Object.fromEntries(Object.keys(sectionLabels).map(key=>[key,"none"]));
  return session.permissions?.[unit] || defaultPermissions(session.roles[unit] || "viewer");
}
export function canUseReportWhatsApp(session: Session, unit: string, write = false): boolean {
  const level = permissionsFor(session, unit).reportWhatsApp || "none";
  return write ? level === "write" : level !== "none";
}
export function canAccess(session: Session, unit: string, page: PageName, write = false): boolean {
  const policy = permissionsFor(session, unit);
  if (page === "settings" && !write) return ["settings", "operationsAdmin", ...(unit.startsWith("remote:") ? [] : ["users"])].some(key => !!policy[key] && policy[key] !== "none") || (!unit.startsWith("remote:") && session.roles[unit] === "admin" && policy.reports === "write");
  if (page === "reports" && !write && canUseReportWhatsApp(session, unit)) return true;
  const level = policy[pageSection(page)] || "none";
  return write ? level === "write" : level !== "none";
}
export function pageSection(page: PageName): string {
  return page === "care" ? "appointments" : page === "responses" ? "groups" : page;
}

// Polling must preserve identity when access and session data have not changed.
export function reconcileSession(current: Session, incoming: Session): Session {
  return JSON.stringify(current) === JSON.stringify(incoming) ? current : incoming;
}
