import { useState } from "react";
import { Trash2 } from "lucide-react";
import { query, request } from "../api";
import InlineDialog from "./InlineDialog";
import "./report-removal.css";

type Row = { id: number; name: string; version: number };
type Page = { results: Row[]; next: string | null };
type Kind = "relatório" | "conexão";

export function RemovalButton({ unit, resource, row, kind, onChanged, dirty = false, showLabel = false }: {
  unit: string; resource: string; row: Row; kind: Kind; onChanged: () => void; dirty?: boolean; showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState("");
  async function show() {
    setOpen(true); setLoading(true); setError("");
    try {
      const result = await request<{ dependencias: string[] }>(query(`${resource}/${row.id}/dependencias`, { unit }));
      setLinks(result.dependencias);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  async function remove() {
    setLoading(true); setError("");
    try {
      await request(query(`${resource}/${row.id}/remover`, { unit }), "POST", { version: row.version });
      setOpen(false); onChanged();
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  return <>
    <button className="button" title={`Remover ${kind}: ${row.name}`} aria-label={`Remover ${kind} ${row.name}`} onClick={() => void show()}><Trash2 size={14}/>{showLabel && " Remover relatório"}</button>
    {open && <InlineDialog title={`Remover ${kind} “${row.name}”?`} subtitle="" busy={loading} onClose={() => setOpen(false)} footer={<>
      <button className="button" onClick={() => setOpen(false)}>Cancelar</button>
      <button className="button report-removal-danger" disabled={loading || !!error || links.length > 0} onClick={() => void remove()}>Remover</button>
    </>}>
      <p>{kind === "relatório" ? "Ele deixará de aparecer para os usuários. Você poderá restaurar em Relatórios removidos." : "Ela deixará de ficar disponível. Os dados e as credenciais serão mantidos para restauração em Conexões removidas."}</p>
      {dirty && <p>As alterações não salvas no editor serão perdidas.</p>}
      {loading && <p>Consultando vínculos…</p>}
      {links.length > 0 && <><p>Remoção bloqueada. Resolva estes vínculos antes de remover:</p><ul>{links.map((link) => <li key={link}>{link}</li>)}</ul></>}
      {error && <div role="alert" className="inline-error">{error}</div>}
    </InlineDialog>}
  </>;
}

export function RemovedRecords({ unit, resource, kind, revision, onChanged }: {
  unit: string; resource: string; kind: Kind; revision: number; onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    try {
      let page = 1; const all: Row[] = [];
      for (;;) {
        const result = await request<Page>(query(resource, { unit, removidos: "1", page: String(page) }));
        all.push(...result.results);
        if (!result.next) break;
        page++;
      }
      setRows(all);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function restore(row: Row) {
    setBusy(true); setError("");
    try {
      await request(query(`${resource}/${row.id}/restaurar`, { unit }), "POST", { version: row.version });
      onChanged();
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-removed-records] summary")?.focus());
      await load();
    }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <details open={expanded} onToggle={(e) => {
    const value = e.currentTarget.open; setExpanded(value);
    if (value) void load();
  }} data-revision={revision} data-removed-records>
    <summary>{kind === "relatório" ? "Relatórios removidos" : "Conexões removidas"}</summary>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {busy && <p>Carregando…</p>}
    {!busy && !rows.length && <p>Nenhum registro removido.</p>}
    {rows.map(row => <div key={row.id} className="report-actions"><span>{row.name}</span><button className="button" aria-label={`Restaurar ${kind} ${row.name}`} disabled={busy} onClick={() => void restore(row)}>Restaurar</button></div>)}
  </details>;
}

