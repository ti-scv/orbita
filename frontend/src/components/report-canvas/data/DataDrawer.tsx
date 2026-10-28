import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, RefreshCw, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { CanvasSource, SourcePreview } from "../model";
import ColumnOrigin, { OriginContext, loadOrigin } from "./ColumnOrigin";
import { fetchSourcePreviewRequest } from "../api/useSourcePreview";
import EmptyState from "../common/EmptyState";
import ColumnBadge from "./ColumnBadge";
import { friendlySourceName } from "./sourceName";
import { formatRowCount } from "./rowCount";
import { formatCellValue } from "./columnTypes";

export interface DataDrawerProps {
  source: CanvasSource | null;
  sourceName?: string;
  datasetName?: string;
  preview: SourcePreview | null;
  loadedAt?: Date | null;
  loading?: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function DataDrawer({
  source,
  sourceName,
  datasetName,
  preview,
  loadedAt,
  loading = false,
  onClose,
  onRefresh,
}: DataDrawerProps) {
  const { reportId, unit } = useContext(OriginContext);
  const [pagePreview, setPagePreview] = useState<SourcePreview | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const pageRequest = useRef(0);
  const currentPreview = pagePreview || preview;
  async function loadPage(nextOffset: number, size = pageSize) {
    if (!source) return;
    const requestId = ++pageRequest.current;
    setPageLoading(true); setPageError("");
    try {
      const effective = currentPreview?.effective_parameters;
      const pageSource = source.type === "report" && effective ? {...source, parameters: Object.fromEntries(effective.map(item => [item.name, item.value]))} : source;
      const result = await fetchSourcePreviewRequest(reportId, unit, pageSource, {}, size, undefined, nextOffset);
      if (requestId !== pageRequest.current) return;
      setPagePreview(result); setOffset(nextOffset); setPageSize(size); setSearch("");
    } catch (error) { if (requestId === pageRequest.current) setPageError((error as Error).message); }
    finally { if (requestId === pageRequest.current) setPageLoading(false); }
  }
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [copied, setCopied] = useState(false);

  const columns: import("../model").ColumnInfo[] =
    currentPreview?.columns ||
    (source?.type === "inline"
      ? source.columns.map((c) => ({
          name: c,
          type: "unknown" as const,
          nullable: true,
          null_count: 0,
        }))
      : []);
  const rawRows = currentPreview?.rows || (source?.type === "inline" ? source.rows : []);
  const columnNames = columns.map(column => column.name).join("\0");
  useEffect(() => {
    if (!source || !columnNames || !reportId || !unit) return;
    let cancelled = false;
    void (async () => {
      for (const column of columnNames.split("\0")) {
        if (cancelled) break;
        try { await loadOrigin(reportId, unit, source, column); } catch { /* The dialog can retry. */ }
      }
    })();
    return () => { cancelled = true; };
  }, [source, columnNames, reportId, unit]);

  // Filter rows locally
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rawRows;
    const term = search.toLowerCase().trim();
    return rawRows.filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(term)),
    );
  }, [rawRows, search]);

  // Sort rows locally
  const sortedRows = useMemo(() => {
    if (sortCol === null || sortCol >= columns.length) return filteredRows;
    const colType = columns[sortCol]?.type;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (colType === "number" || (typeof valA === "number" && typeof valB === "number")) {
        const numA = Number(valA);
        const numB = Number(valB);
        return sortDir === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      const comp = strA.localeCompare(strB, "pt-BR");
      return sortDir === "asc" ? comp : -comp;
    });
  }, [columns, filteredRows, sortCol, sortDir]);

  if (!source) return null;

  const displayRows = sortedRows.slice(0, pageSize);

  const toggleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      if (sortDir === "asc") setSortDir("desc");
      else setSortCol(null);
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const handleCopyTsv = async () => {
    if (!columns.length) return;
    const headerLine = columns.map((c) => c.name).join("\t");
    const rowLines = displayRows.map((r) =>
      r.map((cell) => (cell === null || cell === undefined ? "" : String(cell))).join("\t"),
    );
    const tsv = [headerLine, ...rowLines].join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const totalCount = currentPreview?.total_rows ?? rawRows.length;
  const countText = `Mostrando ${formatRowCount(displayRows.length, currentPreview || {total_rows: totalCount})} · a partir da ${(offset + 1).toLocaleString("pt-BR")}`;

  return (
    <div className="cv-data-drawer cv-root" role="dialog" aria-label={`Dados da fonte ${sourceName || friendlySourceName(source)}`}>
      <details className="cv-column-origins"><summary>Origem das colunas e exemplos</summary>
        <table className="cv-column-metadata"><thead><tr><th>Coluna</th><th>Exemplo</th><th>Origem</th></tr></thead><tbody>{columns.map((col, index) => <tr key={col.name}><td>{col.name}</td><td>{formatCellValue(rawRows.find(row => row[index] != null && String(row[index]).trim() !== "")?.[index], col.type)}</td><td><ColumnOrigin source={source} sourceName={sourceName} datasetName={datasetName} column={col.name} type={col.type} loadedAt={loadedAt} /></td></tr>)}</tbody></table>
      </details>
      <div className="cv-drawer-head">
        <div className="cv-drawer-title-group">
          <h3 className="cv-drawer-title" title={`Dados: ${sourceName || friendlySourceName(source)}`}>
            Dados: {sourceName || friendlySourceName(source)}
          </h3>
          {!loading && <details className="cv-count-help"><summary className="cv-drawer-count">{countText} ⓘ</summary><p>O total considera os parâmetros atuais. A gaveta mostra as linhas da página atual.</p></details>}
          {loading && <span className="cv-chip loading">Atualizando…</span>}
        </div>
        <div className="cv-drawer-controls">
          <input
            type="search"
            className="cv-search-input"
            placeholder="Buscar nas linhas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar nas linhas da prévia"
          />
          <button
            type="button"
            className="cv-btn-compact"
            onClick={handleCopyTsv}
            title="Copiar dados exibidos como TSV"
            disabled={loading || !columns.length}
          >
            {copied ? <Check size={12} color="var(--cv-success)" /> : <Copy size={12} />}
            {copied ? "Copiado!" : "Copiar TSV"}
          </button>
          {onRefresh && (
            <button
              type="button"
              className="cv-icon-btn"
              onClick={() => { if (offset || pagePreview) void loadPage(offset); else onRefresh?.(); }}
              title="Atualizar prévia da fonte"
              disabled={loading}
              aria-label="Atualizar prévia"
            >
              <RefreshCw size={13} className={loading ? "spin" : ""} />
            </button>
          )}
          <button
            type="button"
            className="cv-icon-btn"
            onClick={onClose}
            title="Fechar gaveta de dados"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {pageError && <p role="alert">{pageError}</p>}
      <div className="cv-drawer-pagination">
        <button className="cv-btn-compact" type="button" disabled={loading || pageLoading || offset === 0} onClick={() => void loadPage(Math.max(0, offset - pageSize))}>Anterior</button>
        <button className="cv-btn-compact" type="button" disabled={loading || pageLoading || !(currentPreview?.has_more ?? (offset + rawRows.length < totalCount || currentPreview?.truncated))} onClick={() => void loadPage(currentPreview?.next_offset ?? offset + pageSize)}>Próxima</button>
        <label>Linhas por página <select value={pageSize} disabled={loading || pageLoading} onChange={event => void loadPage(0, Number(event.target.value))}>{[25, 50, 100, 200].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        {pageLoading && <span role="status">Carregando página…</span>}
      </div>
      <div className="cv-drawer-body" aria-busy={loading || pageLoading}>
        {loading ? (
          <div className="cv-drawer-loading" role="status">Carregando dados…</div>
        ) : columns.length === 0 ? (
          <EmptyState
            compact={true}
            title="Nenhuma coluna encontrada"
            description="Esta fonte não possui colunas registradas para exibição."
          />
        ) : (
          <table className="cv-preview-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>#</th>
                {columns.map((col, idx) => (
                  <th key={col.name || idx} onClick={() => toggleSort(idx)} title={`Ordenar por ${col.name}`}>
                    <div className="cv-table-th-content">
                      <ColumnBadge type={col.type} looksLike={col.looks_like} />
                      <span>{col.name}</span>
                      {(

                        <span className="cv-table-null-count" title={`${rawRows.filter(row => row[idx] == null || String(row[idx]).trim() === "").length} valores vazios`}>
                          ({rawRows.filter(row => row[idx] == null || String(row[idx]).trim() === "").length} vazios)
                        </span>
                      )}
                      {sortCol === idx ? (
                        sortDir === "asc" ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        )
                      ) : (
                        <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ textAlign: "center", padding: "20px" }}>
                    <EmptyState
                      compact={true}
                      title="Nenhuma linha retornada"
                      description="A fonte não retornou registros para estes parâmetros."
                    />
                  </td>
                </tr>
              ) : (
                displayRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td style={{ textAlign: "center", color: "var(--cv-text-disabled)" }}>{offset + rIdx + 1}</td>
                    {columns.map((col, cIdx) => {
                      const cellVal = row[cIdx];
                      const isNull = cellVal == null || String(cellVal).trim() === "";
                      const formatted = formatCellValue(cellVal, col.type);
                      const isNum = col.type === "number" || typeof cellVal === "number";

                      return (
                        <td
                          key={cIdx}
                          className={`${isNum ? "cell-number" : ""} ${isNull ? "cell-null" : ""}`}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
