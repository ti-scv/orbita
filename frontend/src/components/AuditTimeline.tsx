import type { Audit } from "../types";
import { Empty } from "./ui";
import { syncCounts } from "./syncCounts";
const titles: Record<string, string> = {
 "user_sync.completed": "Sincronização de usuários concluída", "user_sync.failed": "Falha na sincronização de usuários",
 "user_sync.released": "Usuário sincronizado liberado", "user_sync.conflict_resolved": "Conflito de login resolvido",
 "user_sync.conflict_deferred": "Conflito de login mantido pendente", "user.access_configured": "Acesso de usuário configurado"
};
const roles: Record<string, string> = {admin: "Administrativo", operator: "Operador", viewer: "Consulta"};
export function AuditTimeline({items, dateTime}: {items: Audit[]; dateTime: (value: string) => string}) {
 return <div className="audit-timeline">{items.slice(0, 10).map(item => {
  const d = item.details || {}, parts: string[] = [];
  if (d.login) parts.push("Usuário: " + d.login);
  if (d.new_login) parts.push("Novo login: " + d.new_login);
  if (d.unit) parts.push("Unidade de origem: " + d.unit);
  if (item.action === "user_sync.completed") {
   if (["new", "updated", "removed", "conflicts"].some(k => typeof d[k] === "number")) parts.push(syncCounts(d));
   else if (typeof d.count === "number") parts.push("Total recebido: " + d.count);
  }
  if (d.decision === "separate") parts.push("Decisão: criar conta separada");
  if (d.decision === "pending" || item.action === "user_sync.conflict_deferred") parts.push("Decisão: manter pendente");
  if (Array.isArray(d.access)) for (const access of d.access) {
   if (access && typeof access === "object") parts.push("Acesso: " + (access.unit || "") + " · " + (roles[access.role] || "Perfil não informado") + " · " + (access.type || "Permissões individuais"));
  }
  return <div key={item.id} className="audit-timeline-item"><span className="audit-dot"/><div className="audit-timeline-content"><strong>{titles[item.action] || "Atividade registrada"}</strong><small>{item.actor_name || "Sistema"} · {dateTime(item.created_at)}</small>{parts.length > 0 && <small>{parts.join("; ")}</small>}</div></div>;
 })}{!items.length && <Empty text="Nenhuma atividade registrada."/>}</div>;
}
