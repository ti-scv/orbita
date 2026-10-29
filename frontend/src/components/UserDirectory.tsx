import { Cloud } from "lucide-react";
import Select from "./Select";
import { useEffect, useState } from "react";
import { query, request } from "../api";
import type { Paginated, SectionPermissions } from "../types";
import FormAction from "./FormAction";
import { Panel } from "./ui";
import PermissionRoles, { loadPermissionRoles, roleLabels } from "./PermissionRoles";
import type { PermissionRole } from "./PermissionRoles";

type Grant = { unit: string; role: string; permissions: SectionPermissions; permission_role?: {id: number; name: string} | null; permission_role_outdated?: boolean; roleAction?: number | null; customized?: boolean };
type UserRow = { id: number; username: string; full_name: string; active: boolean; version: number; grants: Grant[]; editable: boolean; global_editable: boolean };
type Option = { slug: string; name: string; remote: boolean; instance_name?: string; editable: boolean; max_role: string; permissions: SectionPermissions };
type Options = { units: Option[]; sections: Record<string, string> };
const profiles: Record<string, string> = { admin: "Administrativo", operator: "Operador", viewer: "Consulta" };
export const templatePermissions = (role: PermissionRole, sections: Record<string, string>): SectionPermissions => {
  const mapping: Record<string, string> = {overview: "messages", messages: "messages", groups: "messages", issues: "messages", settings: "settings", reports: "reports", reportWhatsApp: "reportWhatsApp"};
  return Object.fromEntries(Object.keys(sections).map(key => [key, role.permissions[mapping[key]] || "none"])) as SectionPermissions;
};



export default function UserDirectory({unit, editable = true, onChanged}: {unit: string; editable?: boolean; onChanged?: () => Promise<void>}) {
  const [rows, setRows] = useState<UserRow[]>([]), [options, setOptions] = useState<Options>({units:[], sections:{}});
  const [revision, setRevision] = useState(0), [error, setError] = useState(""), [busy, setBusy] = useState(false);
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
    async function load() {
      const opts = await request<Options>(query("users/options", {unit}));
      const found: UserRow[] = [];
      for (let page=1;;page++) {
        const data = await request<Paginated<UserRow>>(query("users", {unit, search, page:String(page)}));
        found.push(...data.results); if (!data.next) break;
      }
      if(active) {setOptions(opts);setRows(found);}
    }
    load().catch(e=>active&&setError(e.message));
    return ()=>{active=false;};
  }, [unit, revision, search]);
  async function save(row:UserRow|undefined, body:unknown) {
    setBusy(true);setError("");
    try {
      await request(query(row ? `users/${row.id}/configure` : "users",{unit}),"POST",body);
      setRevision(v=>v+1); await onChanged?.();
    } catch(e) {setError((e as Error).message);throw e;} finally {setBusy(false);}
  }
  return <><Panel title="Usuários da instância" action={editable && <UserForm key={`new:${revision}`} options={options} roles={roles} busy={busy} error={error} revision={revision} save={save}/> }>
    {error && <p role="alert" className="inline-error">{error}</p>}
    <label className="op-field">Buscar usuário<input value={search} onChange={e=>setSearch(e.target.value)} /></label>
    <div className="table-scroll"><table className="directory-table"><thead><tr><th>Usuário</th><th>Unidades</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.id}><td><strong>{row.full_name||row.username}</strong><small className="directory-detail">{row.username}</small></td><td>{row.grants.map(g=><small className="directory-detail" key={g.unit}>{options.units.find(u=>u.slug===g.unit)?.name||g.unit} · {g.permission_role?.name || profiles[g.role]}</small>)}{!row.grants.length&&"Sem acesso"}</td><td>{row.active?"Ativo":"Desativado"}</td><td>{editable&&row.editable?<UserForm key={`${row.id}:${row.version}`} row={row} options={options} roles={roles} busy={busy} error={error} revision={revision} save={save}/>:"—"}</td></tr>)}
    </tbody></table></div>{!rows.length&&<p className="directory-empty">Nenhum usuário encontrado.</p>}
  </Panel>{editable && !unit.startsWith("remote:") && <PermissionRoles unit={unit} onChanged={() => setRevision(v => v + 1)}/>}</>;
}

function UserForm({row, options, roles, busy, error, revision, save}:{row?:UserRow;options:Options;roles:Record<string, PermissionRole[]>;busy:boolean;error:string;revision:number;save:(row:UserRow|undefined,body:unknown)=>Promise<void>}) {
  const [username,setUsername]=useState(row?.username||""),[name,setName]=useState(row?.full_name||""),[password,setPassword]=useState("");
  const [active,setActive]=useState(row?.active??true),[grants,setGrants]=useState<Grant[]>(row?.grants||[]);
  const global = !row || row.global_editable;
  const none=()=>Object.fromEntries(Object.keys(options.sections).map(k=>[k,"none"])) as SectionPermissions;
  function update(slug:string, change:Partial<Grant>) {setGrants(v=>v.map(g=>g.unit===slug?{...g,...change}:g));}
  function setRole(slug:string, role:string) {
    const grant=grants.find(g=>g.unit===slug)!;
    const permissions={...grant.permissions};
    for (const key of Object.keys(permissions)) if (permissions[key]==="write" && (role==="viewer" || (role!=="admin"&&["settings","operationsAdmin","users"].includes(key)))) permissions[key]="read";
    if(role!=="admin")permissions.users="none";
    update(slug,{role,permissions, ...(grant.permission_role ? {permission_role: null, roleAction: null, customized: true, permission_role_outdated: false} : {})});
  }
  return <FormAction title={row?"Editar usuário":"Novo usuário"} label={row?"Editar":"Novo usuário"} busy={busy} error={error} version={revision} onClose={()=>{setUsername(row?.username||""); setName(row?.full_name||""); setPassword(""); setActive(row?.active??true); setGrants(row?.grants||[]);}}>
    <form className="op-form" onSubmit={e=>{e.preventDefault();void save(row,{version:row?.version||0,username,full_name:name,active,grants:grants.filter(g=>options.units.some(o=>o.slug===g.unit&&o.editable)).map(({customized: _customized, roleAction, permission_role: _role, permission_role_outdated: _outdated, ...g})=>({...g, ...(roleAction !== undefined ? {permission_role: roleAction} : {})})),...(password?{password}:{})}).then(()=>setPassword("")).catch(()=>{});}}>
      <div className="op-two"><label className="op-field">Login<input required minLength={3} maxLength={150} disabled={!!row} autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)}/></label>
        <label className="op-field">Nome<input maxLength={150} disabled={!global} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="op-field">{row?"Nova senha (opcional)":"Senha inicial"}<input type="password" required={!row} minLength={12} maxLength={200} disabled={!global} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      </div>
      <label className="checkbox-label"><input type="checkbox" disabled={!global} checked={active} onChange={e=>setActive(e.target.checked)}/>Usuário ativo</label>
      <h3>Unidades e abas</h3>
      {options.units.map(option=>{
        const grant=grants.find(g=>g.unit===option.slug);
        const selectedRole = grant?.permission_role && (roles[option.slug] || []).find(r => r.id === grant.permission_role?.id);
        return <fieldset key={option.slug} className="access-grant" disabled={!option.editable}>
          <legend><label className="checkbox-label"><input type="checkbox" checked={!!grant} onChange={e=>setGrants(v=>e.target.checked?[...v,{unit:option.slug,role:"operator",permissions:none(),customized:true}]:v.filter(g=>g.unit!==option.slug))}/>{option.remote && <Cloud size={14} />}{option.name}{option.remote?` · ${option.instance_name}`:" · Local"}</label></legend>
          {grant&&<><label className="op-field">Perfil<Select value={grant.role} onChange={e=>setRole(option.slug,e.target.value)}>{Object.entries(profiles).filter(([key])=>option.max_role==="admin"||key!=="admin"&&(option.max_role!=="viewer"||key==="viewer")).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select></label>
            {!option.remote && <label className="op-field">Tipo de usuário<Select value={selectedRole?.id || ""} onChange={e=>{const selected=(roles[option.slug] || []).find(r=>r.id===Number(e.target.value)); if (selected && !grant.permission_role && !window.confirm("Aplicar este tipo substituirá as permissões individuais. Continuar?")) return; update(option.slug, selected ? {permission_role:{id:selected.id,name:selected.name}, roleAction:selected.id, permission_role_outdated:false, permissions:templatePermissions(selected, options.sections), customized:false} : {permission_role:null, roleAction:null, permission_role_outdated:false, customized:true});}}><option value="">Permissões individuais</option>{(roles[option.slug] || []).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select></label>}
            {grant.customized && <p>Este acesso usa Permissões individuais e não segue um tipo de usuário.</p>}
            {grant.permission_role_outdated && selectedRole && <p role="status">As permissões deste acesso estão desatualizadas em relação ao tipo. Os níveis atuais do acesso serão mantidos até reaplicar o tipo. <button type="button" className="button" onClick={()=>update(option.slug,{roleAction:selectedRole.id, permission_role_outdated:false, permissions:templatePermissions(selectedRole, options.sections)})}>Reaplicar tipo</button></p>}
            {selectedRole && <><div className="table-scroll"><table className="directory-table"><thead><tr><th>Permissão do tipo</th><th>Acesso</th></tr></thead><tbody>{Object.entries(roleLabels).map(([key,label])=><tr key={key}><td>{label}</td><td>{selectedRole.permissions[key] === "write" ? "Ver e editar" : selectedRole.permissions[key] === "read" ? "Somente leitura" : "Sem acesso"}</td></tr>)}</tbody></table></div><button type="button" className="button" onClick={()=>update(option.slug,{permission_role:null, roleAction:null, permission_role_outdated:false, customized:true})}>Personalizar</button><p>Ao personalizar, este acesso deixa de seguir o tipo e passa a usar Permissões individuais.</p></>}
            {!selectedRole && <div className="table-scroll"><table className="directory-table"><thead><tr><th>Seção / configuração</th><th>Acesso</th></tr></thead><tbody>{Object.entries(options.sections).map(([key,originalLabel])=>{
               const label = ({settings:"Configurações · Integrações e envios",operationsAdmin:"Configurações · Cadastros",users:"Configurações · Usuários"} as Record<string,string>)[key] || originalLabel;
              const max=option.permissions[key]||"none";
              return <tr key={key}><td>{label}{key === "reportWhatsApp" && <small className="directory-detail">Somente leitura: ver o estado. Ver e editar: ver, conectar e desconectar.</small>}</td><td><Select aria-label={`${option.name} — ${label}`} value={grant.permissions[key]||"none"} onChange={e=>update(option.slug,{permissions:{...grant.permissions,[key]:e.target.value as "none"|"read"|"write"}})}>
                <option value="none">Sem acesso</option>{max!=="none"&&<option value="read">Somente leitura</option>}{max==="write"&&grant.role!=="viewer"&&(grant.role==="admin"||!["settings","operationsAdmin","users"].includes(key))&&<option value="write">Ver e editar</option>}
              </Select></td></tr>;
            })}</tbody></table></div>}</>}
        </fieldset>;
      })}
      <button type="submit" className="button primary" disabled={busy}>Salvar usuário</button>
    </form>
  </FormAction>;
}
