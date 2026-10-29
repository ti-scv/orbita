import { Cloud } from "lucide-react";
import { AlertTriangle } from "./icons";
import Select from "./Select";
import { useEffect, useState } from "react";
import { query, request } from "../api";
import type { Paginated, SectionPermissions } from "../types";
import FormAction from "./FormAction";
import { Panel } from "./ui";
import PermissionRoles, { loadPermissionRoles, roleLabels } from "./PermissionRoles";
import type { PermissionRole } from "./PermissionRoles";
import { PermissionGroups } from "./PermissionGroups";

type Grant = { unit: string; role: string; permissions: SectionPermissions; permission_role?: {id: number; name: string} | null; permission_role_outdated?: boolean; roleAction?: number | null; customized?: boolean };
type UserRow = { id: number; username: string; full_name: string; active: boolean; version: number; grants: Grant[]; editable: boolean; global_editable: boolean };
type Synced = { id: number; user_id: number | null; login: string; name: string; unit: string; state: string; removed_at_origin: boolean };
type Option = { slug: string; name: string; remote: boolean; instance_name?: string; local_unit?: string; editable: boolean; max_role: string; permissions: SectionPermissions };
type Options = { units: Option[]; sections: Record<string, string> };
const profiles: Record<string, string> = { admin: "Administrativo", operator: "Operador", viewer: "Consulta" };
const levels = {none: 0, read: 1, write: 2} as const;
export function limitRemoteGrant(grant: Grant, option: Option): Grant {
  if (!option.remote) return grant;
  const rank: Record<string, number> = {viewer: 0, operator: 1, admin: 2};
  const role = rank[grant.role] > rank[option.max_role] ? option.max_role : grant.role;
  const permissions = Object.fromEntries(Object.entries(grant.permissions).map(([key, value]) => {
    const connectionMax = option.permissions[key] || "none";
    const roleMax = key === "costs" || key === "users" && role !== "admin" ? "none" : role === "viewer" || role !== "admin" && ["settings", "operationsAdmin", "users"].includes(key) ? "read" : "write";
    const max = levels[connectionMax] < levels[roleMax] ? connectionMax : roleMax;
    return [key, levels[value] > levels[max] ? max : value];
  })) as SectionPermissions;
  return {...grant, role, permissions};
}
export const templatePermissions = (role: PermissionRole, sections: Record<string, string>): SectionPermissions => {
  const mapping: Record<string, string> = {overview: "overview", messages: "messages", groups: "groups", issues: "issues", settings: "settings", reports: "reports", reportWhatsApp: "reportWhatsApp"};
  return Object.fromEntries(Object.keys(sections).map(key => [key, role.permissions[mapping[key]] || (["overview","groups","issues"].includes(key) ? role.permissions.messages : "none") || "none"])) as SectionPermissions;
};


export function applyTypeToGrants(grants: Grant[], option: Option, units: Option[], selected: PermissionRole, sections: Record<string, string>): Grant[] {
  const permissions = templatePermissions(selected, sections);
  return grants.map(g => g.unit === option.slug
    ? {...g, permission_role: {id: selected.id, name: selected.name}, roleAction: selected.id, permission_role_outdated: false, permissions, customized: false}
    : units.some(o => o.remote && o.editable && o.local_unit === option.slug && o.slug === g.unit)
      ? {...g, permissions, permission_role: null, roleAction: null, customized: true}
      : g);
}

export default function UserDirectory({unit, editable = true, onChanged}: {unit: string; editable?: boolean; onChanged?: () => Promise<void>}) {
  const [synced, setSynced] = useState<Synced[]>([]);
  const [rows, setRows] = useState<UserRow[]>([]), [options, setOptions] = useState<Options>({units:[], sections:{}});
  const [revision, setRevision] = useState(0), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<Record<string, PermissionRole[]>>({});
  useEffect(() => {
    let alive = true;
    if (editable) Promise.all(options.units.filter(o => o.editable && !o.remote).map(async o => [o.slug, await loadPermissionRoles(o.slug)] as const))
      .then(entries => {if (alive) setRoles(Object.fromEntries(entries));})
      .catch(e => {if (alive) setError(e.message);});
    return () => {alive = false;};
  }, [options, editable, revision]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    async function load() {
      const [opts, first] = await Promise.all([
        request<Options>(query("users/options", {unit})),
        request<Paginated<UserRow>>(query("users", {unit, search, page:"1"})),
      ]);
      const found: UserRow[] = [...first.results];
      let next = first.next;
      for (let page=2; next; page++) {
        const data = await request<Paginated<UserRow>>(query("users", {unit, search, page:String(page)}));
        found.push(...data.results); next = data.next;
      }
      const identities = editable && !unit.startsWith("remote:") ? await request<Synced[]>(query("users/synced", {unit})).catch(() => []) : [];
      if(active) {setOptions(opts);setRows(found);setSynced(identities);}
    }
    load().catch(e=>active&&setError(e.message)).finally(()=>{if(active) setLoading(false);});
    return ()=>{active=false;};
  }, [unit, revision, search, editable]);
  async function save(row:UserRow|undefined, body:unknown, identity?: Synced) {
    setBusy(true);setError("");
    try {
      const result = await request<{limitations?: {unit: string; sections: string[]}[]}>(query(identity ? `users/${identity.id}/release-synced` : row ? `users/${row.id}/configure` : "users",{unit}),"POST",body);
      setNotice((result.limitations || []).map(item => `${item.unit}: ${item.sections.join(", ")}`).join("; "));
      setRevision(v=>v+1); await onChanged?.();
    } catch(e) {setError((e as Error).message);throw e;} finally {setBusy(false);}
  }
  async function resolve(identity: Synced, username: string) {
    setBusy(true); setError("");
    try { await request(query(`users/${identity.id}/resolve-sync-conflict`, {unit}), "POST", {username}); setRevision(v => v + 1); }
    catch (e) { setError((e as Error).message); throw e; }
    finally { setBusy(false); }
  }
  return <><Panel title="Usuários da instância" action={editable && <UserForm key={`new:${revision}`} options={options} roles={roles} busy={busy} error={error} revision={revision} save={save}/> }>
    {error && <p role="alert" className="inline-error">{error}</p>}
    <label className="op-field">Buscar usuário<input value={search} onChange={e=>setSearch(e.target.value)} /></label>
    {notice && <div role="alert" className="directory-remote-warning"><AlertTriangle size={20} /><span>Acesso remoto limitado pelo perfil ou pelas permissões da conexão em {notice}. Confira os níveis efetivos no acesso da unidade.</span></div>}
    {editable && synced.filter(item => item.state !== "released" || item.removed_at_origin).map(item => {
      const row = rows.find(user => user.id === item.user_id);
      return <div key={item.id} className="directory-detail">
        {item.name || item.login} · {item.unit} · {item.removed_at_origin ? "Removido na origem" : item.state === "conflict" ? "Conflito de login" : "Pendente de liberação"}
        {!item.removed_at_origin && item.state === "pending" && row && <UserForm row={row} identity={item} options={options} roles={roles} busy={busy} error={error} revision={revision} save={save} />}
        {!item.removed_at_origin && item.state === "conflict" && <FormAction title="Resolver conflito de login" label="Resolver conflito" busy={busy} error={error} version={revision}><form className="op-form" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void resolve(item, String(form.get("username") || "")).catch(() => {}); }}><label className="op-field">Novo login<input name="username" minLength={3} maxLength={150} required /></label><button className="button primary" disabled={busy}>Criar conta separada</button></form></FormAction>}
      </div>;
    })}
    <div className="table-scroll"><table className="directory-table"><thead><tr><th>Usuário</th><th>Unidades</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.id}><td><strong>{row.full_name||row.username}</strong><small className="directory-detail">{row.username}</small></td><td>{row.grants.map(g=><small className="directory-detail" key={g.unit}>{options.units.find(u=>u.slug===g.unit)?.name||g.unit} · {g.permission_role?.name || profiles[g.role]}</small>)}{!row.grants.length&&"Sem acesso"}</td><td>{row.active?"Ativo":"Desativado"}</td><td>{editable&&row.editable&&!synced.some(item => item.user_id === row.id && (item.state !== "released" || item.removed_at_origin))?<UserForm key={`${row.id}:${row.version}`} row={row} options={options} roles={roles} busy={busy} error={error} revision={revision} save={save}/>:"—"}</td></tr>)}
    </tbody></table></div>{loading ? <p role="status">Carregando usuários…</p> : !error && !rows.length && <p className="directory-empty">Nenhum usuário encontrado.</p>}
  </Panel>{editable && !unit.startsWith("remote:") && <PermissionRoles unit={unit} onChanged={() => setRevision(v => v + 1)}/>}</>;
}

function UserForm({row, identity, options, roles, busy, error, revision, save}:{row?:UserRow;identity?:Synced;options:Options;roles:Record<string, PermissionRole[]>;busy:boolean;error:string;revision:number;save:(row:UserRow|undefined,body:unknown,identity?:Synced)=>Promise<void>}) {
  const [username,setUsername]=useState(row?.username||""),[name,setName]=useState(row?.full_name||""),[password,setPassword]=useState("");
  const normalize = (items: Grant[]) => items.map(g => ({...g, permissions: {...g.permissions}}));
  const limited = (row?.grants || []).filter(g => { const option = options.units.find(o => o.slug === g.unit); return option?.remote && JSON.stringify(limitRemoteGrant(g, option)) !== JSON.stringify(g); });
  const [active,setActive]=useState(identity ? true : row?.active??true),[grants,setGrants]=useState<Grant[]>(() => normalize(row?.grants||[]));
  const global = !row || row.global_editable;
  const none=()=>Object.fromEntries(Object.keys(options.sections).map(k=>[k,"none"])) as SectionPermissions;
  function update(slug:string, change:Partial<Grant>) {setGrants(v=>v.map(g=>g.unit===slug?{...g,...change}:g));}
  function setRole(slug:string, role:string) {
    const grant=grants.find(g=>g.unit===slug)!;
    if (grant.permission_role && role !== grant.role && !window.confirm("Alterar o perfil desvinculará o tipo e manterá permissões individuais. Continuar?")) return;
    const permissions={...grant.permissions};
    for (const key of Object.keys(permissions)) if (permissions[key]==="write" && (role==="viewer" || (role!=="admin"&&["settings","operationsAdmin","users"].includes(key)))) permissions[key]="read";
    if(role!=="admin")permissions.users="none";
    update(slug,{role,permissions, ...(grant.permission_role ? {permission_role: null, roleAction: null, customized: true, permission_role_outdated: false} : {})});
  }
  return <FormAction title={identity?"Liberar usuário":row?"Editar usuário":"Novo usuário"} label={identity?"Liberar":row?"Editar":"Novo usuário"} busy={busy} error={error} version={revision} onClose={()=>{setUsername(row?.username||""); setName(row?.full_name||""); setPassword(""); setActive(row?.active??true); setGrants(normalize(row?.grants||[]));}}>
    <form className="op-form" onSubmit={e=>{e.preventDefault();void save(row,{version:row?.version||0,username,full_name:name,active,grants:grants.filter(g=>options.units.some(o=>o.slug===g.unit&&o.editable)).map(({customized: _customized, roleAction, permission_role: _role, permission_role_outdated: _outdated, ...g})=>({...g, ...(roleAction !== undefined ? {permission_role: roleAction} : {})})),...(password?{password}:{})}, identity).then(()=>setPassword("")).catch(()=>{});}}>
      <div className="op-two"><label className="op-field">Login<input required minLength={3} maxLength={150} disabled={!!row} autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)}/></label>
        <label className="op-field">Nome<input maxLength={150} disabled={!global} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="op-field">{row&&!identity?"Nova senha (opcional)":"Senha inicial"}<input type="password" required={!row || !!identity} minLength={12} maxLength={200} disabled={!global} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      </div>
      <label className="checkbox-label"><input type="checkbox" disabled={!global} checked={active} onChange={e=>setActive(e.target.checked)}/>Usuário ativo</label>
      <h3>Unidades e abas</h3>
      {limited.map(g => { const option = options.units.find(o=>o.slug===g.unit)!; const capped = limitRemoteGrant(g, option); const changes = Object.keys(g.permissions).filter(k=>g.permissions[k] !== capped.permissions[k]).map(k=>options.sections[k] || k); if (g.role !== capped.role) changes.unshift(`Perfil limitado a ${profiles[capped.role]}`); return <p role="status" key={g.unit}>Acesso em {option.name} limitado: {changes.join(", ")}.</p>; })}
      {options.units.map(option=>{
        const requestedGrant=grants.find(g=>g.unit===option.slug);
        const grant=requestedGrant && limitRemoteGrant(requestedGrant, option);
        const remoteChanges = requestedGrant && grant && option.remote ? Object.keys(requestedGrant.permissions).filter(k => requestedGrant.permissions[k] !== grant.permissions[k]).map(k => options.sections[k] || k) : [];
        const selectedRole = grant?.permission_role && (roles[option.slug] || []).find(r => r.id === grant.permission_role?.id);
        return <fieldset key={option.slug} className="access-grant" disabled={!option.editable}>
          <legend><label className="checkbox-label"><input type="checkbox" checked={!!grant} onChange={e=>setGrants(v=>e.target.checked?[...v,{unit:option.slug,role:"operator",permissions:option.remote && option.local_unit ? (() => { const local = v.find(g => g.unit === option.local_unit); const selected = (roles[option.local_unit] || []).find(r => r.id === local?.permission_role?.id); return selected ? templatePermissions(selected, options.sections) : none(); })() : none(),customized:true}]:v.filter(g=>g.unit!==option.slug))}/>{option.remote && <Cloud size={14} />}{option.name}{option.remote?` · ${option.instance_name}`:" · Local"}</label></legend>
          {grant&&<><label className="op-field">Perfil<Select value={grant.role} onChange={e=>setRole(option.slug,e.target.value)}>{Object.entries(profiles).filter(([key])=>option.max_role==="admin"||key!=="admin"&&(option.max_role!=="viewer"||key==="viewer")).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select></label>
            {!option.remote && <label className="op-field">Tipo de usuário<Select value={selectedRole?.id || ""} onChange={e=>{const selected=(roles[option.slug] || []).find(r=>r.id===Number(e.target.value)); if (selected && row?.grants.some(g=>g.unit===option.slug) && !window.confirm("Aplicar este tipo substituirá as permissões individuais nesta unidade e nos acessos remotos vinculados. Continuar?")) { e.currentTarget.value = String(selectedRole?.id || ""); return; } if (selected) { setGrants(current=>applyTypeToGrants(current, option, options.units, selected, options.sections)); } else update(option.slug, {permission_role:null, roleAction:null, permission_role_outdated:false, customized:true});}}><option value="">Permissões individuais</option>{(roles[option.slug] || []).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select></label>}
            {remoteChanges.length > 0 && <p role="status">Acesso em {option.name} limitado nas seções: {remoteChanges.join(", ")}. Confira os níveis efetivos abaixo.</p>}
            {option.remote && <p role="status">Acesso remoto: os níveis abaixo são os níveis efetivos, limitados pelo perfil e pela conexão desta unidade. Não há tipo de usuário associado ao acesso remoto.</p>}
            {grant.customized && <p>Este acesso usa Permissões individuais e não segue um tipo de usuário.</p>}
            {grant.permission_role_outdated && selectedRole && <p role="status">As permissões deste acesso estão desatualizadas em relação ao tipo. Os níveis atuais do acesso serão mantidos até reaplicar o tipo. <button type="button" className="button" onClick={()=>{if (window.confirm("Reaplicar este tipo substituirá as permissões nesta unidade e nos acessos remotos vinculados. Continuar?")) setGrants(current=>applyTypeToGrants(current, option, options.units, selectedRole, options.sections));}}>Reaplicar tipo</button></p>}
            {selectedRole && <><PermissionGroups sections={roleLabels} render={(key,label)=><p key={key}>{label}: {(selectedRole.permissions[key] || (["overview","groups","issues"].includes(key) ? selectedRole.permissions.messages : "none")) === "write" ? "Ver e editar" : (selectedRole.permissions[key] || (["overview","groups","issues"].includes(key) ? selectedRole.permissions.messages : "none")) === "read" ? "Somente leitura" : "Sem acesso"}</p>}/><button type="button" className="button" onClick={()=>update(option.slug,{permission_role:null, roleAction:null, permission_role_outdated:false, customized:true})}>Personalizar</button><p>Ao personalizar, este acesso deixa de seguir o tipo e passa a usar Permissões individuais.</p></>}
            {!selectedRole && <PermissionGroups sections={options.sections} render={(key,originalLabel)=>{
               const label = ({settings:"Configurações · Integrações e envios",operationsAdmin:"Configurações · Cadastros",users:"Configurações · Usuários"} as Record<string,string>)[key] || originalLabel;
              const max=option.permissions[key]||"none";
              return <label className="op-field" key={key}>{label}{key === "reportWhatsApp" && <small className="directory-detail">Somente leitura: ver o estado. Ver e editar: ver, conectar e desconectar.</small>}<Select aria-label={`${option.name} — ${label}`} value={grant.permissions[key]||"none"} onChange={e=>update(option.slug,{permissions:{...grant.permissions,[key]:e.target.value as "none"|"read"|"write"}})}>
                <option value="none">Sem acesso</option>{max!=="none"&&<option value="read">Somente leitura</option>}{max==="write"&&grant.role!=="viewer"&&(grant.role==="admin"||!["settings","operationsAdmin","users"].includes(key))&&<option value="write">Ver e editar</option>}
              </Select></label>;
            }}/>}</>}
        </fieldset>;
      })}
      <button type="submit" className="button primary" disabled={busy}>Salvar usuário</button>
    </form>
  </FormAction>;
}
