import { createContext, useContext, useEffect, useState } from "react";
import InlineDialog from "../../InlineDialog";
import { query, request } from "../../../api";
import type { CanvasSource } from "../model";
export const OriginContext = createContext<{reportId: number; unit: string; lastReads?: Record<string, Date | null>}>({reportId: 0, unit: ""});
export interface OriginDetails { source: string; report?: string; column: string; database: string; query: string; expression: string }
export function highlightColumn(sql: string, column: string) {
  if (!column) return sql;
  const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sql.split(new RegExp(`(?<![A-Za-z0-9_])(${escaped})(?![A-Za-z0-9_])`, "gi")).map((part, index) => part.toLocaleLowerCase() === column.toLocaleLowerCase() ? <mark key={index}>{part}</mark> : part);
}
export default function ColumnOrigin({ source, column, type = "unknown", loadedAt, sourceName, datasetName }: { source?: CanvasSource; column: string; type?: string; loadedAt?: Date | string | null; sourceName?: string; datasetName?: string }) {
  const {reportId, unit, lastReads} = useContext(OriginContext);
  const readAt = loadedAt || (source && lastReads?.[source.id]);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<OriginDetails | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    if (!open || !source) return;
    let current = true;
    setData(null); setError(""); setCopyStatus("");
    request<OriginDetails>(query(`reports/${reportId}/canvas-column-origin`, {unit}), "POST", {source, column}).then(value => { if (current) setData(value); }).catch(exc => { if (current) setError((exc as Error).message); });
    return () => { current = false; };
  }, [open, source, column, reportId, unit]);
  return <>
    <span className="cv-origin-text">{source?.type === "report" ? `${sourceName || source.label || "Fonte"} › ${datasetName || source.dataset || "Dados"} › ${column}` : source?.type === "inline" ? `Fixa › ${column}` : `Calculada › ${column}`}</span>
    <button type="button" className="cv-btn-compact" title="Ver detalhes e consulta da origem" aria-label={`Origem da coluna ${column}`} disabled={!source} onClick={event => {event.stopPropagation(); setOpen(true);}}>Origem</button>
    {open && <InlineDialog title={`Origem da coluna ${column}`} subtitle="Somente leitura" onClose={() => setOpen(false)} className="cv-root" footer={<button type="button" className="cv-btn-compact" disabled={!data?.query} onClick={async () => { try { await navigator.clipboard.writeText(data?.query || ""); setCopyStatus("Consulta copiada"); } catch { setCopyStatus("Não foi possível copiar a consulta"); } }}>Copiar consulta</button>}>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Carregando origem…</p>}
      {data && <>
        <dl><dt>Fonte</dt><dd>{data.source}{data.report ? ` · ${data.report}` : ""}</dd><dt>Coluna</dt><dd>{column}</dd><dt>Tipo</dt><dd>{({number:"Número", string:"Texto", date:"Data", datetime:"Data e hora", boolean:"Sim/não", unknown:"Não identificado"} as Record<string,string>)[type] || type}</dd><dt>Banco de origem</dt><dd>{data.database}</dd><dt>Última leitura da prévia</dt><dd>{readAt ? new Date(readAt).toLocaleString("pt-BR") : "Não registrada"}</dd></dl>
        {data.expression && <p>{data.expression}</p>}
        {data.query && <pre style={{whiteSpace:"pre-wrap", overflowWrap:"anywhere", maxHeight:"40vh", overflow:"auto"}} aria-label="Consulta da coluna">{highlightColumn(data.query, column)}</pre>}
      </>}
      <p role="status">{copyStatus}</p>
    </InlineDialog>}
  </>;
}
