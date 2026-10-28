import { useState } from "react";
import { Trash2 } from "lucide-react";
import { query, request } from "../api";
import InlineDialog from "./InlineDialog";
import "./report-removal.css";

type Row = { id: number; name: string; version: number };
type Page = { results: Row[]; next: string | null; remocao_disponivel?: boolean };
type Kind = "relatório" | "conexão";

export function RemovalButton({ unit, resource, row, kind, onChanged, dirty = false, showLabel = false, menuItem = false, onOpened, onDismiss }: {
  unit: string; resource: string; row: Row; kind: Kind; onChanged: () => void; dirty?: boolean; showLabel?: boolean; menuItem?: boolean; onOpened?: () => void; onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState("");
  async function show() {
    onOpened?.(); setOpen(true); setLoading(true); setError("");
    try {
      const result = await request<{ dependencias: string[]; remocao_disponivel?: boolean }>(query(`${resource}/${row.id}/dependencias`, { unit }));
      setLinks(result.dependencias); setAvailable(result.remocao_disponivel !== false);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  const reportCount = links.filter(link => link.startsWith("Relatório: ")).length;
  const scheduleCount = links.filter(link => link.startsWith("Agendamento") || link.startsWith("Programação")).length;
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
    <button role={menuItem ? "menuitem" : undefined} className="button" title={`Remover ${kind}: ${row.name}`} aria-label={`Remover ${kind} ${row.name}`} onClick={() => void show()}><Trash2 size={14}/>{showLabel && " Remover relatório"}</button>
    {open && <InlineDialog title={`Remover ${kind} “${row.name}”?`} subtitle="" busy={loading} onClose={() => { setOpen(false); onDismiss?.(); }} footer={<>
      <button className="button" onClick={() => { setOpen(false); onDismiss?.(); }}>Cancelar</button>
      <button className="button report-removal-danger" disabled={loading || !available || !!error || links.length > 0} onClick={() => void remove()}>Remover</button>
    </>}>
      <p>{kind === "relatório" ? "Ele deixará de aparecer para os usuários." : "Ela deixará de ficar disponível."}</p>
      {!available && <p>A remoção ainda não foi liberada neste ambiente.</p>}
      {dirty && <p>As alterações não salvas no editor serão perdidas.</p>}
      {loading && <p>Consultando vínculos…</p>}
      {kind === "conexão" && reportCount > 0 && <p>Usada por {reportCount} {reportCount === 1 ? "relatório" : "relatórios"}.</p>}
      {kind === "relatório" && scheduleCount > 0 && <p>Tem {scheduleCount} {scheduleCount === 1 ? "agendamento ou programação" : "agendamentos ou programações"}.</p>}
      {!loading && !error && !links.length && kind === "relatório" && <p>Sem agendamentos nem vínculos.</p>}
      {links.length > 0 && <><p>{available ? "Remoção bloqueada. Resolva estes vínculos antes de remover:" : "Vínculos existentes:"}</p><ul>{links.map((link) => <li key={link}>{link}</li>)}</ul></>}
      {error && <div role="alert" className="inline-error">{error}</div>}
    </InlineDialog>}
  </>;
}

export function RemovedRecords({ unit, resource, kind, revision, onChanged }: {
  unit: string; resource: string; kind: Kind; revision: number; onChanged: () => void;
}) {
  const [available, setAvailable] = useState(true);
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
        if (result.remocao_disponivel === false) setAvailable(false);
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
    if (value && available) void load();
  }} data-revision={revision} data-removed-records>
    <summary>{kind === "relatório" ? "Relatórios removidos" : "Conexões removidas"}</summary>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {busy && <p>Carregando…</p>}
    {!busy && !available && <p>A remoção ainda não foi liberada neste ambiente.</p>}
    {!busy && available && !rows.length && <p>Nenhum registro removido.</p>}
    {rows.map(row => <div key={row.id} className="report-actions"><span>{row.name}</span><button className="button" aria-label={`Restaurar ${kind} ${row.name}`} disabled={busy} onClick={() => void restore(row)}>Restaurar</button></div>)}
  </details>;
}

