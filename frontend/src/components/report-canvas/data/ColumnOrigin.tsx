import { friendlySourceError } from "./sourceName";
import { createContext, useContext, useEffect, useState } from "react";
import InlineDialog from "../../InlineDialog";
import { query, request } from "../../../api";
import type { CanvasSource, CatalogSqlSource } from "../model";
export const OriginContext = createContext<{reportId: number; unit: string; lastReads?: Record<string, Date | null>; sources?: CatalogSqlSource[]}>({reportId: 0, unit: ""});
const originCache = new Map<string, { expires: number; promise: Promise<OriginDetails> }>();
export function loadOrigin(reportId: number, unit: string, source: CanvasSource, column: string) {
  const key = JSON.stringify([reportId, unit, source, column]);
  const cached = originCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = request<OriginDetails>(query(`reports/${reportId}/canvas-column-origin`, {unit}), "POST", {source, column});
  originCache.set(key, {expires: Date.now() + 30000, promise});
  promise.catch(() => originCache.delete(key));
  return promise;
}
export interface OriginDetails { source: string; report?: string; column: string; database: string; query: string; expression: string }
export function highlightColumn(sql: string, column: string) {
  if (!column) return sql;
  const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sql.split(new RegExp(`(?<![A-Za-z0-9_])(${escaped})(?![A-Za-z0-9_])`, "gi")).map((part, index) => part.toLocaleLowerCase() === column.toLocaleLowerCase() ? <mark key={index}>{part}</mark> : part);
}
export default function ColumnOrigin({ source, column, type = "unknown", loadedAt, sourceName, datasetName }: { source?: CanvasSource; column: string; type?: string; loadedAt?: Date | string | null; sourceName?: string; datasetName?: string }) {
  const {reportId, unit, lastReads, sources = []} = useContext(OriginContext);
  const catalog = source?.type === "report" ? sources.find(item => item.id === source.report_id) : undefined;
  const friendlySource = sourceName || catalog?.name || source?.label || "Fonte";
  const friendlyDataset = datasetName || catalog?.datasets?.find(item => source?.type === "report" && item.id === source.dataset)?.name || "Dados";
  const readAt = loadedAt || (source && lastReads?.[source.id]);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<OriginDetails | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    if (!open || !source) return;
    let current = true;
    setData(null); setError(""); setCopyStatus("");
    loadOrigin(reportId, unit, source, column).then(value => { if (current) setData(value); }).catch(exc => { if (current) setError(friendlySourceError((exc as Error).message, source, catalog)); });
    return () => { current = false; };
  }, [open, source, column, reportId, unit]);
  return <>
    <span className="cv-origin-text" title={`${friendlySource} › ${friendlyDataset}`}>{source?.type === "report" ? `${friendlySource} › ${friendlyDataset}` : source?.type === "inline" ? `Fixa › ${column}` : `Calculada › ${column}`}</span>
    <button type="button" className="cv-btn-compact" title="Ver detalhes e consulta da origem" aria-label={`Origem da coluna ${column}`} disabled={!source} onMouseEnter={() => { if (source) void loadOrigin(reportId, unit, source, column).catch(() => {}); }} onFocus={() => { if (source) void loadOrigin(reportId, unit, source, column).catch(() => {}); }} onClick={event => {event.stopPropagation(); setOpen(true);}}>Origem</button>
    {open && <InlineDialog title={`Origem da coluna ${column}`} subtitle="Somente leitura" onClose={() => setOpen(false)} className="cv-root" footer={<button type="button" className="cv-btn-compact" disabled={!data?.query} onClick={async () => { try { await navigator.clipboard.writeText(data?.query || ""); setCopyStatus("Consulta copiada"); } catch { setCopyStatus("Não foi possível copiar a consulta"); } }}>Copiar consulta</button>}>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <div role="status" aria-label="Carregando origem"><p>Carregando origem…</p><div className="cv-origin-skeleton" aria-hidden="true"><div /><div /><div /></div></div>}
      {data && <>
        <dl className="cv-origin-details"><dt>Fonte</dt><dd>{source?.type === "report" ? `${friendlySource} › ${friendlyDataset}` : friendlySource}</dd><dt>Coluna</dt><dd>{column}</dd><dt>Tipo</dt><dd>{({number:"Número", text:"Texto", string:"Texto", date:"Data", datetime:"Data e hora", boolean:"Sim/não", unknown:"Não identificado"} as Record<string,string>)[type] || type}</dd><dt>Banco de origem</dt><dd>{data.database}</dd><dt>Última leitura da prévia</dt><dd>{readAt ? new Date(readAt).toLocaleString("pt-BR", { hour12: false }) : "Não registrada"}</dd></dl>
        {data.expression && <p>{data.expression}</p>}
        {data.query && <pre style={{whiteSpace:"pre-wrap", overflowWrap:"anywhere", maxHeight:"40vh", overflow:"auto"}} aria-label="Consulta da coluna">{highlightColumn(data.query, column)}</pre>}
      </>}
      <p role="status">{copyStatus}</p>
    </InlineDialog>}
  </>;
}
