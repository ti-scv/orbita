import { useEffect, useState } from "react";
import { query, request } from "../api";
import type { Paginated, SectionPermissions } from "../types";
import FormAction from "./FormAction";
import Select from "./Select";
import { Panel } from "./ui";

export type PermissionRole = { id: number; name: string; permissions: SectionPermissions };
export const roleLabels: Record<string, string> = {messages: "Mensagens", settings: "Configurações", reports: "Relatórios", reportWhatsApp: "WhatsApp dos relatórios"};
export async function loadPermissionRoles(unit: string): Promise<PermissionRole[]> {
  const roles: PermissionRole[] = [];
  for (let page = 1;; page++) {
    const result = await request<Paginated<PermissionRole>>(query("permission-roles", {unit, page: String(page)}));
    roles.push(...result.results);
    if (!result.next) return roles;
  }
}
export default function PermissionRoles({unit}: {unit: string}) {
  const [roles, setRoles] = useState<PermissionRole[]>([]), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { let active = true; setRoles([]); setError(""); loadPermissionRoles(unit).then(r => {if (active) setRoles(r);}).catch(e => {if (active) setError(e.message);}); return () => {active = false;}; }, [unit, revision]);
  async function save(row: PermissionRole | undefined, name: string, permissions: SectionPermissions) {
    setBusy(true); setError("");
    try { await request(query(row ? `permission-roles/${row.id}` : "permission-roles", {unit}), row ? "PATCH" : "POST", {name, permissions}); setRevision(v => v + 1); }
    catch (e) {setError((e as Error).message); throw e;} finally {setBusy(false);}
  }
  return <Panel title="Tipos de usuário" action={<RoleForm key={`new:${revision}`} revision={revision} busy={busy} error={error} save={save}/> }>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="table-scroll"><table className="directory-table"><thead><tr><th>Tipo</th><th>Permissões</th><th>Ações</th></tr></thead><tbody>{roles.map(row => <tr key={row.id}><td>{row.name}</td><td>{Object.entries(roleLabels).map(([key,label]) => <small className="directory-detail" key={key}>{label}: {row.permissions[key] === "write" ? "Ver e editar" : row.permissions[key] === "read" ? "Somente leitura" : "Sem acesso"}</small>)}</td><td><RoleForm key={`${row.id}:${revision}`} row={row} revision={revision} busy={busy} error={error} save={save}/></td></tr>)}</tbody></table></div>
    {!roles.length && <p className="directory-empty">Nenhum tipo cadastrado.</p>}
  </Panel>;
}
function RoleForm({row, revision, busy, error, save}: {row?: PermissionRole; revision: number; busy: boolean; error: string; save: (row: PermissionRole | undefined, name: string, permissions: SectionPermissions) => Promise<void>}) {
  const [name, setName] = useState(row?.name || ""), [permissions, setPermissions] = useState<SectionPermissions>(row?.permissions || {messages:"none", settings:"none", reports:"none", reportWhatsApp:"none"});
  return <FormAction title={row ? "Editar tipo de usuário" : "Novo tipo de usuário"} label={row ? "Editar" : "Adicionar"} busy={busy} error={error} version={revision}><form className="op-form" onSubmit={e => {e.preventDefault(); void save(row, name, permissions).catch(() => {});}}>
    <label className="op-field">Nome<input required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
    {Object.entries(roleLabels).map(([key,label]) => <label className="op-field" key={key}>{label}<Select value={permissions[key] || "none"} onChange={e => setPermissions({...permissions, [key]: e.target.value as "none" | "read" | "write"})}><option value="none">Sem acesso</option><option value="read">Somente leitura</option><option value="write">Ver e editar</option></Select></label>)}
    <button type="submit" className="button primary">Salvar</button>
  </form></FormAction>;
}
