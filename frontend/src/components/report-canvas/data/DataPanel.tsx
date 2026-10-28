import { formatRowCount } from "./rowCount";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ChevronRight,
  Edit3,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PreviewCacheScope, fetchSourcePreviewRequest, getCachedSourcePreview, isUnavailableStatus, setCachedSourcePreview } from "../api/useSourcePreview";
import type {
  CanvasBlock,
  CanvasLayout,
  CanvasSource,
  CatalogSqlSource,
  ColumnInfo,
  SourcePreview,
} from "../model";
import ColumnOrigin from "./ColumnOrigin";
import ColumnBadge from "./ColumnBadge";
import { formatCellValue, formatColumnTypeLabel } from "./columnTypes";
import DataDrawer from "./DataDrawer";
import EmptyState from "../common/EmptyState";
import { findSourceUsages } from "./sourceOps";

export interface DataPanelProps {
  stagePreviewStates?: Record<string, SourcePreviewEntry>;
  onLoadStagePreview?: (sourceId: string) => Promise<void>;
  active: boolean;
  sources: CanvasSource[];
  availableSources: CatalogSqlSource[];
  layout?: CanvasLayout;
  selectedBlock?: CanvasBlock | null;
  reportId?: number;
  unit?: string;
  onCreateSource: () => void;
  onEditSource: (src: CanvasSource) => void;
  onRemoveSource: (sourceId: string) => void;
  onSelectBlock?: (blockId: string) => void;
  onUpdateBlock?: (
    blockId: string,
    label: string,
    updater: (b: CanvasBlock) => CanvasBlock,
  ) => void;
}

interface SourcePreviewEntry {
  status: "idle" | "loading" | "ready" | "error" | "unavailable";
  data: SourcePreview | null;
  error: string | null;
  loadedAt: Date | null;
  httpStatus?: number;
  elapsedMs?: number;
}

export default function DataPanel({
  active,
  stagePreviewStates,
  onLoadStagePreview,
  sources,
  availableSources,
  layout,
  selectedBlock,
  reportId = 1,
  unit = "",
  onCreateSource,
  onEditSource,
  onRemoveSource,
  onSelectBlock,
  onUpdateBlock,
}: DataPanelProps) {
  const cacheScope = useContext(PreviewCacheScope);
  const previewAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    previewAbortRef.current = controller;
    return () => controller.abort();
  }, []);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [localPreviews, setPreviews] = useState<Record<string, SourcePreviewEntry>>({});
  const previews = { ...localPreviews, ...stagePreviewStates };
  const [drawerSource, setDrawerSource] = useState<CanvasSource | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<CanvasSource | null>(null);
  const [activeMenuCol, setActiveMenuCol] = useState<{ sourceId: string; colName: string } | null>(null);

  // Load preview for a given source
  const handleLoadPreview = useCallback(
    async (src: CanvasSource, bypassCache = false) => {
      if (src.type === "report" && onLoadStagePreview) {
        await onLoadStagePreview(src.id);
        return;
      }
      if (!bypassCache) {
        const cached = getCachedSourcePreview(src, (src.type === "report" && src.parameters) || {}, 50, cacheScope);
        if (cached) {
          setPreviews((prev) => ({
            ...prev,
            [src.id]: {
              status: "ready",
              data: cached,
              error: null,
              loadedAt: cached.loaded_at ? new Date(cached.loaded_at) : new Date(),
            },
          }));
          return;
        }
      }

      setPreviews((prev) => ({
        ...prev,
        [src.id]: {
          status: "loading",
          data: prev[src.id]?.data || null,
          error: null,
          loadedAt: prev[src.id]?.loadedAt || null,
        },
      }));

      const signal = previewAbortRef.current?.signal;
      const startedAt = performance.now();
      try {
        const result = await fetchSourcePreviewRequest(
          reportId,
          unit,
          src,
          (src.type === "report" && src.parameters) || {},
          50,
          signal,
        );
        if (signal?.aborted) return;

        setCachedSourcePreview(src, result, (src.type === "report" && src.parameters) || {}, 50, cacheScope);

        setPreviews((prev) => ({
          ...prev,
          [src.id]: {
            status: "ready",
            data: result,
            error: null,
            loadedAt: new Date(),
          },
        }));
      } catch (err: any) {
        if (signal?.aborted || err?.name === "AbortError") return;
        const msg = err?.message || "Erro ao carregar prévia.";
        const status = err?.status || err?.response?.status;
        const unavail = isUnavailableStatus(status, msg);

        setPreviews((prev) => ({
          ...prev,
          [src.id]: {
            status: unavail ? "unavailable" : "error",
            data: null,
            error: unavail ? "Prévia de dados indisponível nesta versão do servidor" : msg,
            loadedAt: null,
            httpStatus: typeof status === "number" ? status : undefined,
            elapsedMs: Math.round(performance.now() - startedAt),
          },
        }));
      }
    },
    [reportId, unit, cacheScope, onLoadStagePreview],
  );

  const toggleExpand = (src: CanvasSource) => {
    if (expandedSourceId === src.id) {
      setExpandedSourceId(null);
    } else {
      setExpandedSourceId(src.id);
      // If no preview loaded, initialize from cached or idle
      if (!previews[src.id]) {
        const cached = getCachedSourcePreview(src, (src.type === "report" && src.parameters) || {}, 50, cacheScope);
        if (cached) {
          setPreviews((prev) => ({
            ...prev,
            [src.id]: {
              status: "ready",
              data: cached,
              error: null,
              loadedAt: cached.loaded_at ? new Date(cached.loaded_at) : new Date(),
            },
          }));
        }
      }
    }
  };

  const handleOpenDrawer = (src: CanvasSource) => {
    setDrawerSource(src);
    if (!previews[src.id]?.data && previews[src.id]?.status !== "loading") {
      void handleLoadPreview(src);
    }
  };

  // Get columns for a source (from preview if available, else from source definition)
  const getSourceColumns = (src: CanvasSource): ColumnInfo[] => {
    const preview = previews[src.id]?.data || getCachedSourcePreview(src, (src.type === "report" && src.parameters) || {}, 50, cacheScope);
    if (preview?.columns?.length) {
      return preview.columns;
    }
    if (src.type === "inline") {
      return src.columns.map((c) => ({
        name: c,
        type: "unknown" as const,
      }));
    }
    if (src.type === "goals") {
      return [
        { name: "year", type: "number" as const },
        { name: "month", type: "number" as const },
        { name: "value", type: "number" as const },
      ];
    }
    const catalog = availableSources.find((c) => c.id === src.report_id);
    const dataset = catalog?.datasets?.find((d) => d.id === (src.dataset || "rows"));
    const cols = dataset?.columns || catalog?.columns || [];
    return cols.map((c) => ({
      name: c,
      type: "unknown" as const,
    }));
  };

  // "Usar como..." actions
  const applyColumnAction = (action: "x_field" | "y_fields" | "value_field" | "columns", column: string) => {
    if (!selectedBlock || !onUpdateBlock) return;
    setActiveMenuCol(null);

    if (action === "x_field") {
      onUpdateBlock(selectedBlock.id, "Definir eixo X", (b) => ({
        ...b,
        options: { ...b.options, x_field: column },
      }));
    } else if (action === "y_fields") {
      onUpdateBlock(selectedBlock.id, "Adicionar série Y", (b) => {
        const existing = b.options?.y_fields || [];
        const next = existing.includes(column) ? existing : [...existing, column].slice(0, 6);
        return {
          ...b,
          options: { ...b.options, y_fields: next },
        };
      });
    } else if (action === "value_field") {
      onUpdateBlock(selectedBlock.id, "Definir valor do KPI", (b) => ({
        ...b,
        options: { ...b.options, value_field: column },
      }));
    } else if (action === "columns") {
      onUpdateBlock(selectedBlock.id, "Adicionar coluna à tabela", (b) => {
        const existing = b.options?.columns || [];
        const next = existing.includes(column) ? existing : [...existing, column].slice(0, 100);
        return {
          ...b,
          options: { ...b.options, columns: next },
        };
      });
    }
  };

  const isChart = selectedBlock?.type === "bar" || selectedBlock?.type === "line" || selectedBlock?.type === "pie";
  const isKpi = selectedBlock?.type === "kpi";
  const isTable = selectedBlock?.type === "table";

  // Blocks using the source to delete
  const blocksUsingToDelete = useMemo(() => {
    if (!sourceToDelete || !layout) return [];
    return findSourceUsages(layout, sourceToDelete.id);
  }, [layout, sourceToDelete]);

  const handleConfirmDelete = () => {
    if (sourceToDelete) {
      onRemoveSource(sourceToDelete.id);
      setSourceToDelete(null);
      if (drawerSource?.id === sourceToDelete.id) {
        setDrawerSource(null);
      }
    }
  };

  return (
    <section className="cv-data-panel cv-root" hidden={!active}>
      {/* Cabeçalho: Título + Contador + Adicionar fonte */}
      <div className="cv-data-head">
        <div className="cv-data-head-left">
          <h3 className="cv-data-title">Fontes</h3>
          <span className="cv-data-count">{sources.length}/30</span>
        </div>
        <button
          type="button"
          className="cv-btn-compact primary"
          onClick={onCreateSource}
          title="Adicionar nova fonte de dados"
        >
          <Plus size={12} />
          Adicionar fonte
        </button>
      </div>

      {/* Lista de Registros */}
      {sources.length === 0 ? (
        <EmptyState
          title="Nenhuma fonte conectada"
          description="Nenhuma fonte. Adicione uma fonte para ligar dados aos blocos."
          actionLabel="Adicionar fonte"
          onAction={onCreateSource}
        />
      ) : (
        <div className="cv-source-list">
          {sources.map((src) => {
            const isExpanded = expandedSourceId === src.id;
            const previewState = previews[src.id];
            const cached = getCachedSourcePreview(src, (src.type === "report" && src.parameters) || {}, 50, cacheScope);
            const previewData = previewState?.data || cached;
            const columns = getSourceColumns(src);

            const sqlItem =
              src.type === "report"
                ? availableSources.find((c) => c.id === src.report_id)
                : undefined;

            const subtitle =
              src.type === "report"
                ? `${sqlItem?.name || "Relatório"} › ${sqlItem?.datasets?.find(item => item.id === src.dataset)?.name || "Dados"}`
                : src.type === "inline"
                  ? `Tabela manual (${src.columns.length} colunas)`
                  : "Metas mensais (year, month, value)";

            const displayName = src.type === "report" && (!src.label || src.label.toLowerCase() === "dados") ? subtitle : src.label || src.id;
            const usages = layout ? findSourceUsages(layout, src.id) : [];

            return (
              <div
                key={src.id}
                className={`cv-source-item ${isExpanded ? "expanded" : ""}`}
              >
                <div
                  className="cv-source-row"
                >
                  <div className="cv-source-main">
                    <button type="button" className="cv-source-title-line cv-btn-compact" onClick={() => toggleExpand(src)} aria-expanded={isExpanded} aria-label={`Colunas de ${displayName}`}>
                      <ChevronRight
                        size={14}
                        className={`cv-source-chevron ${isExpanded ? "open" : ""}`}
                      />
                      <span className="cv-source-label" title={displayName}>
                        {displayName}
                      </span>

                    </button>
                    <span className="cv-source-sub" title={subtitle}>
                      {subtitle}
                    </span>

                    {/* Chips de Estado */}
                    <div className="cv-source-chips">
                      {previewState?.status === "loading" && (
                        <span className="cv-chip loading">
                          <RefreshCw size={10} className="spin" /> Carregando…
                        </span>
                      )}

                      {previewState?.status === "error" && (
                        <span
                          className="cv-chip error"
                          title={previewState.error || "Erro na consulta"}
                        >
                          <AlertCircle size={10} /> Erro
                        </span>
                      )}

                      {previewState?.status === "unavailable" && (
                        <span
                          className="cv-chip unavailable"
                          title="Prévia de dados indisponível nesta versão do servidor"
                        >
                          Prévia indisponível
                        </span>
                      )}

                      {previewData && previewState?.status !== "loading" && previewState?.status !== "error" && (
                        <span className="cv-chip ready">
                          {formatRowCount(previewData.rows.length, previewData)} (com os parâmetros atuais)
                          {previewState?.loadedAt && (
                            <> · {previewState.loadedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false })}</>
                          )}
                        </span>
                      )}

                      {!previewData && !previewState?.status && (
                        <span className="cv-chip">Prévia não carregada</span>
                      )}

                      {usages.length > 0 && (
                        <span
                          className="cv-chip clickable"
                          title="Clique para selecionar os blocos vinculados"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectBlock && usages[0]) {
                              onSelectBlock(usages[0].blockId);
                            }
                          }}
                        >
                          Usada em {usages.length} bloco{usages.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações por registro */}
                  <div className="cv-source-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="cv-icon-btn"
                      title="Ver dados reais da fonte"
                      aria-label={`Ver dados de ${displayName}`}
                      onClick={() => handleOpenDrawer(src)}
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      type="button"
                      className="cv-icon-btn"
                      title="Atualizar prévia de dados"
                      aria-label={`Atualizar prévia de ${displayName}`}
                      disabled={previewState?.status === "loading"}
                      onClick={() => handleLoadPreview(src, true)}
                    >
                      <RefreshCw size={13} className={previewState?.status === "loading" ? "spin" : ""} />
                    </button>
                    <button
                      type="button"
                      className="cv-icon-btn"
                      title="Editar fonte de dados"
                      aria-label={`Editar fonte ${displayName}`}
                      onClick={() => onEditSource(src)}
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      type="button"
                      className="cv-icon-btn danger"
                      title="Remover fonte"
                      aria-label={`Remover fonte ${displayName}`}
                      onClick={() => setSourceToDelete(src)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isExpanded && previewState?.status === "error" && (
                  <div role="alert">
                    <p>Fonte: {displayName}. {(previewState.error || "Não foi possível carregar a prévia.").replaceAll(`Fonte "${src.id}"`, `Fonte "${displayName}"`)}</p>
                    <button type="button" className="cv-btn-compact" onClick={async (event) => { const button = event.currentTarget; try { await navigator.clipboard.writeText(`Fonte: ${displayName}\n${previewState.error}\nHTTP ${previewState.httpStatus ?? "indisponível"}\nTempo: ${previewState.elapsedMs ?? "indisponível"} ms`); button.textContent = "Detalhes copiados"; } catch { button.textContent = "Não foi possível copiar"; } }}>Copiar detalhes</button>
                    <p>{previewState.httpStatus != null ? `HTTP ${previewState.httpStatus}` : "HTTP indisponível"} · {previewState.elapsedMs != null ? `${previewState.elapsedMs} ms` : "tempo indisponível"}</p>
                    <button type="button" className="cv-btn-compact" onClick={() => void handleLoadPreview(src, true)}>Tentar de novo</button>
                  </div>
                )}
                {/* Lista Expandida de Colunas */}
                {isExpanded && (
                  <div className="cv-column-list">
                    {columns.length === 0 ? (
                      <span className="cv-column-hint">Nenhuma coluna detectada.</span>
                    ) : (
                      <>
                        {!previewData && (
                          <span className="cv-column-hint">
                            Carregue a prévia para ver os tipos e exemplos reais.
                          </span>
                        )}
                        {columns.map((col) => {
                          const rawSample = col.sample?.[0];
                          const sampleVal = rawSample == null || rawSample === "" ? "" : formatCellValue(rawSample, col.type);
                          const hasPreview = Boolean(previewData);
                          const isMenuOpen =
                            activeMenuCol?.sourceId === src.id &&
                            activeMenuCol?.colName === col.name;

                          return (
                            <div
                              key={col.name}
                              className="cv-column-row"
                              draggable={true}
                              onDragStart={(e: DragEvent<HTMLDivElement>) => {
                                e.dataTransfer.setData(
                                  "application/x-canvas-column",
                                  JSON.stringify({
                                    sourceId: src.id,
                                    column: col.name,
                                    type: col.type,
                                  }),
                                );
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              title={`Arraste para campos do inspetor ou use o menu. Tipo: ${col.type}`}
                            >
                              <div className="cv-column-left">
                                <ColumnBadge
                                  type={hasPreview ? col.type : "unknown"}
                                  looksLike={col.looks_like}
                                />
                                <span className="cv-column-name" title={col.name}>{col.name}</span><span className="cv-column-type">{formatColumnTypeLabel(col.type)}</span>
                              </div>

                              {sampleVal && (
                                <span className="cv-column-sample" title={sampleVal}>
                                  Exemplo: {sampleVal}
                                </span>
                              )}

                              <ColumnOrigin source={src} column={col.name} type={col.type} loadedAt={previewState?.loadedAt} />
                              {/* Menu Usar como... */}
                              <div className="cv-use-as-dropdown">
                                <button
                                  type="button"
                                  className="cv-icon-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Usar coluna no bloco selecionado"
                                  aria-label={`Usar coluna ${col.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuCol(isMenuOpen ? null : { sourceId: src.id, colName: col.name });
                                  }}
                                >
                                  <MoreHorizontal size={12} />
                                </button>

                                {isMenuOpen && (
                                  <div
                                    className="cv-use-menu"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="cv-use-item"
                                      disabled={!isChart}
                                      title={!isChart ? "Selecione um gráfico" : ""}
                                      onClick={() => applyColumnAction("x_field", col.name)}
                                    >
                                      <span>Eixo X</span>
                                      {!isChart && <span style={{ fontSize: 10 }}>(selecione gráfico)</span>}
                                    </button>

                                    <button
                                      type="button"
                                      className="cv-use-item"
                                      disabled={!isChart}
                                      title={!isChart ? "Selecione um gráfico" : ""}
                                      onClick={() => applyColumnAction("y_fields", col.name)}
                                    >
                                      <span>Série Y</span>
                                      {!isChart && <span style={{ fontSize: 10 }}>(selecione gráfico)</span>}
                                    </button>

                                    <button
                                      type="button"
                                      className="cv-use-item"
                                      disabled={!isKpi}
                                      title={!isKpi ? "Selecione um bloco KPI" : ""}
                                      onClick={() => applyColumnAction("value_field", col.name)}
                                    >
                                      <span>Valor do KPI</span>
                                      {!isKpi && <span style={{ fontSize: 10 }}>(selecione KPI)</span>}
                                    </button>

                                    <button
                                      type="button"
                                      className="cv-use-item"
                                      disabled={!isTable}
                                      title={!isTable ? "Selecione uma tabela" : ""}
                                      onClick={() => applyColumnAction("columns", col.name)}
                                    >
                                      <span>Coluna da tabela</span>
                                      {!isTable && <span style={{ fontSize: 10 }}>(selecione tabela)</span>}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Gaveta Ver Dados (DataDrawer) */}
      {drawerSource && createPortal(
        <DataDrawer
          key={drawerSource.id}
          source={drawerSource}
          datasetName={drawerSource.type === "report" ? availableSources.find(item => item.id === drawerSource.report_id)?.datasets?.find(item => item.id === drawerSource.dataset)?.name : undefined}
          sourceName={drawerSource.label && drawerSource.label.toLowerCase() !== "dados" ? drawerSource.label : availableSources.find(item => drawerSource.type === "report" && item.id === drawerSource.report_id)?.name || drawerSource.label || "Dados"}
          preview={previews[drawerSource.id]?.data || getCachedSourcePreview(drawerSource, (drawerSource.type === "report" && drawerSource.parameters) || {}, 50, cacheScope) || null}
          loadedAt={previews[drawerSource.id]?.loadedAt}
          loading={previews[drawerSource.id]?.status === "loading"}
          onClose={() => setDrawerSource(null)}
          onRefresh={() => handleLoadPreview(drawerSource, true)}
        />,
        document.body,
      )}

      {/* Confirmação de Remoção com lista de blocos afetados */}
      {sourceToDelete && (
        <div
          className="modal-backdrop observation-backdrop cv-root"
          onClick={() => setSourceToDelete(null)}
          style={{ zIndex: "var(--cv-z-modal)" }}
        >
          <div
            className="modal inline-dialog"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="confirm-delete-title"
          >
            <header className="observation-header">
              <h2 id="confirm-delete-title">Remover fonte de dados</h2>
              <p className="inline-dialog-subtitle">
                Confirmação de exclusão da fonte "{sourceToDelete.label || sourceToDelete.id}"
              </p>
            </header>

            <div className="inline-dialog-body">
              {blocksUsingToDelete.length > 0 ? (
                <>
                  <p style={{ color: "var(--cv-danger)", fontWeight: 500, margin: "0 0 8px 0" }}>
                    Atenção: esta fonte está sendo usada em {blocksUsingToDelete.length} bloco
                    {blocksUsingToDelete.length > 1 ? "s" : ""}:
                  </p>
                  <ul
                    style={{
                      maxHeight: 120,
                      overflowY: "auto",
                      paddingLeft: 20,
                      margin: "0 0 12px 0",
                      fontSize: 12,
                      color: "var(--cv-text-2)",
                    }}
                  >
                    {blocksUsingToDelete.map((b) => (
                      <li key={b.blockId}>
                        [{b.pageName}] {b.blockTitle} ({b.blockType})
                      </li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 12, color: "var(--cv-text-3)", margin: 0 }}>
                    Ao remover, estes blocos ficarão com o status <em>"Fonte removida"</em> e
                    precisarão ser reconfigurados.
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--cv-text-2)" }}>
                  Tem certeza que deseja remover esta fonte? Nenhum bloco está vinculado a ela no
                  momento.
                </p>
              )}
            </div>

            <div className="inline-dialog-actions">
              <button
                type="button"
                className="cv-btn-compact"
                onClick={() => setSourceToDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cv-btn-compact danger"
                style={{ background: "var(--cv-danger)", color: "#fff", borderColor: "var(--cv-danger)" }}
                onClick={handleConfirmDelete}
              >
                Confirmar remoção
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
