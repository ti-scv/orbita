import { formatRowCount } from "../data/rowCount";
import { previewPeriod, expandedPreviewParameters } from "../hooks/useStagePreviews";
import PreviewParameters from "../blocks/PreviewParameters";
import type { StagePreviewState as SourcePreviewState } from "../hooks/useStagePreviews";
import { memo, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent } from "react";
import BlockPreview from "../blocks/BlockPreview";
import type {
  CanvasAssetMeta,
  CanvasBlock,
  CanvasSource,
  CatalogSqlSource,
} from "../model";
import { BLOCK_LABELS } from "../model";
import type { CanvasProblemItem } from "../shell/problems";
import { describeBlockLineage } from "../shell/problems";
import type { ResizeHandle } from "./geometry";

export interface BlockFrameProps {
  block: CanvasBlock;
  isSelected: boolean;
  overlapping?: boolean;
  isDragging: boolean;
  background: string;
  sources: CanvasSource[];
  assets: CanvasAssetMeta[];
  assetUrls: Record<string, string>;
  availableSources: CatalogSqlSource[];
  localDatasets: Map<string, { columns: string[]; rows: unknown[][] }>;
  reportName: string;
  showSampleData: boolean;
  pageName?: string;
  pageIndex?: number;
  tempGeometry?: { x: number; y: number; width: number; height: number; tooltip?: string };
  problem?: CanvasProblemItem;
  onOpenProblem?: (problem: CanvasProblemItem) => void;
  previewState?: SourcePreviewState;
  onLoadSourcePreview?: (sourceId: string, parameters?: Record<string, unknown>) => void;
  onStartDrag: (e: ReactPointerEvent, block: CanvasBlock) => void;
  onStartResize: (e: ReactPointerEvent, block: CanvasBlock, handle: ResizeHandle) => void;
  onKeyboardResize?: (blockId: string, dx: number, dy: number) => void;
  onFocusBlock: (blockId: string) => void;
  onToggleBlock?: (blockId: string) => void;
  onRemoveBlock?: (blockId: string) => void;
  selectedCount?: number;
}

const ALL_HANDLES: { handle: ResizeHandle; label: string; className: string }[] = [
  { handle: "nw", label: "Redimensionar topo-esquerda", className: "cv-resize-handle cv-resize-handle-nw" },
  { handle: "n", label: "Redimensionar altura para cima", className: "cv-resize-handle cv-resize-handle-n" },
  { handle: "ne", label: "Redimensionar topo-direita", className: "cv-resize-handle cv-resize-handle-ne" },
  { handle: "e", label: "Redimensionar largura", className: "cv-resize-handle cv-resize-handle-e" },
  { handle: "se", label: "Redimensionar bloco", className: "cv-resize-handle cv-resize-handle-se" },
  { handle: "s", label: "Redimensionar altura", className: "cv-resize-handle cv-resize-handle-s" },
  { handle: "sw", label: "Redimensionar base-esquerda", className: "cv-resize-handle cv-resize-handle-sw" },
  { handle: "w", label: "Redimensionar largura para esquerda", className: "cv-resize-handle cv-resize-handle-w" },
];

function BlockFrameComponent({
  block,
  isSelected,
  overlapping = false,
  isDragging,
  background,
  sources,
  assets,
  assetUrls,
  availableSources,
  localDatasets,
  reportName,
  showSampleData,
  pageName,
  pageIndex = 0,
  tempGeometry,
  problem,
  onOpenProblem,
  onLoadSourcePreview,
  previewState,
  onStartDrag,
  onStartResize,
  onFocusBlock,
  onToggleBlock,
  onRemoveBlock,
  selectedCount = 1,
  onKeyboardResize,
}: BlockFrameProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const openMenu = (element: HTMLElement, x: number, y: number) => {
    const stage = element.closest(".cv-stage")?.getBoundingClientRect();
    const left = stage?.left ?? 0;
    const right = stage?.right ?? window.innerWidth;
    const top = stage?.top ?? 0;
    const bottom = stage?.bottom ?? window.innerHeight;
    setMenuPosition({ x: Math.max(left, Math.min(x, right - 220)), y: Math.max(top, Math.min(y, bottom - 70)) });
  };
  const currentX = tempGeometry ? tempGeometry.x : block.x;
  const currentY = tempGeometry ? tempGeometry.y : block.y;
  const currentW = tempGeometry ? tempGeometry.width : block.width;
  const currentH = tempGeometry ? tempGeometry.height : block.height;

  const assetFilenames = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a.filename])),
    [assets],
  );
  const lineage = useMemo(
    () => describeBlockLineage(block, sources.map(src => {
      if (src.type !== "report" || (src.label && src.label.toLowerCase() !== "dados")) return src;
      const catalog = availableSources.find(item => item.id === src.report_id);
      return {...src, label: `${catalog?.name || "Fonte"} › ${catalog?.datasets?.find(item => item.id === src.dataset)?.name || "Dados"}`};
    }), assetFilenames),
    [block, sources, assetFilenames, availableSources],
  );

  let originState: "no_source" | "preview" | "sample" = "sample";
  let originLabel = "Exemplo";
  let hasMissingSource = false;
  let canLoadPreview = false;
  let blockSourceId: string | undefined;

  if (block.type === "image") {
    if (!block.asset_id) {
      originState = "no_source";
      originLabel = "Sem imagem";
      hasMissingSource = true;
    } else {
      originState = "preview";
      originLabel = "Imagem vinculada";
    }
  } else if (block.type === "text") {
    if (block.source_id) {
      blockSourceId = block.source_id;
      const src = sources.find((s) => s.id === block.source_id);
      if (!src) {
        originState = "no_source";
        originLabel = "Sem fonte";
        hasMissingSource = true;
      } else {
        const local = localDatasets.get(src.id);
        const rowsCount = local?.rows?.length || 0;
        if (!showSampleData && local) {
          originState = "preview";
          originLabel = previewState?.data ? `Prévia · ${formatRowCount(rowsCount, previewState.data)}` : `Prévia · ${rowsCount} linhas`;
        } else {
          originState = "sample";
          originLabel = "Exemplo";
          if (!showSampleData && rowsCount === 0 && src.type === "report") {
            canLoadPreview = true;
          }
        }
      }
    } else {
      originState = showSampleData ? "sample" : "preview";
      originLabel = showSampleData ? "Exemplo" : "Texto do relatório";
    }
  } else {
    // table, kpi, bar, line, pie
    if (!block.source_id) {
      originState = "no_source";
      originLabel = "Sem fonte";
      hasMissingSource = true;
    } else {
      blockSourceId = block.source_id;
      const src = sources.find((s) => s.id === block.source_id);
      if (!src) {
        originState = "no_source";
        originLabel = "Sem fonte";
        hasMissingSource = true;
      } else {
        const local = localDatasets.get(src.id);
        const rowsCount = local?.rows?.length || 0;
        if (!showSampleData && local) {
          originState = "preview";
          originLabel = previewState?.data ? `Prévia · ${formatRowCount(rowsCount, previewState.data)}` : `Prévia · ${rowsCount} linhas`;
        } else {
          originState = "sample";
          originLabel = "Exemplo";
          if (!showSampleData && rowsCount === 0 && src.type === "report") {
            canLoadPreview = true;
          }
        }
      }
    }
  }

  if (!showSampleData && blockSourceId && sources.find(s => s.id === blockSourceId)?.type === "report" && !localDatasets.has(blockSourceId)) {
    originState = "preview";
    originLabel = previewState?.status === "loading" ? "Prévia · carregando…" : previewState?.status === "idle" && previewState.fields?.length ? "Prévia · parâmetros" : "Prévia · indisponível";
    canLoadPreview = false;
  }

  const period = previewPeriod(previewState?.fields, previewState?.values);
  if (!showSampleData && period) originLabel += ` · período ${period}${previewState?.assumed ? " (padrão)" : ""}`;

  const waitingForPreview = !showSampleData && blockSourceId && sources.find(s => s.id === blockSourceId)?.type === "report" && !previewState && !localDatasets.has(blockSourceId);
  const blockDisplayName = block.title || BLOCK_LABELS[block.type];
  const pageLabel = pageName || `página ${pageIndex + 1}`;
  const ariaLabel = `${BLOCK_LABELS[block.type]}, ${blockDisplayName}, ${pageLabel}`;

  return (
    <div
      ref={frameRef}
      data-block-id={block.id}
      role="group"
      tabIndex={0}
      aria-label={ariaLabel}
      title="Use Shift e clique para selecionar mais componentes. Clique com o botão direito para abrir as ações."
      className={`cv-block cv-block-${block.type} ${isSelected ? "is-selected" : ""} ${
        isDragging ? "is-dragging" : ""
      } ${problem ? `has-problem is-${problem.severity}` : ""} ${overlapping ? "is-overlapping" : ""}`.trim()}
      style={{
        left: `${isDragging ? block.x : currentX}px`,
        top: `${isDragging ? block.y : currentY}px`,
        transform: isDragging ? `translate3d(${currentX - block.x}px, ${currentY - block.y}px, 0)` : undefined,
        width: `${currentW}px`,
        height: `${currentH}px`,
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button, input, select, textarea, a, [contenteditable]")) return;
        if ((e.shiftKey || e.ctrlKey || e.metaKey) && onToggleBlock) { e.preventDefault(); onToggleBlock(block.id); return; }
        onStartDrag(e, block);
      }}
      onFocus={(e) => { if (e.target === e.currentTarget && !isSelected) onFocusBlock(block.id); }}
      onContextMenu={(e) => { if (!onRemoveBlock) return; e.preventDefault(); if (!isSelected) onFocusBlock(block.id); openMenu(e.currentTarget, e.clientX, e.clientY); }}
      onKeyDown={(e) => {
        if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && onRemoveBlock) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); openMenu(e.currentTarget, r.left, r.top); }
        if (e.shiftKey && e.key === " " && onToggleBlock && e.target === e.currentTarget) { e.preventDefault(); e.stopPropagation(); onToggleBlock(block.id); }
        if (e.key === "Escape" && menuPosition) { e.stopPropagation(); setMenuPosition(null); frameRef.current?.focus(); }
      }}
    >
      {menuPosition && onRemoveBlock && frameRef.current?.closest(".cv-root") && createPortal(
        <div role="menu" className="cv-block-context-menu" style={{ left: menuPosition.x, top: menuPosition.y }}>
          <button type="button" role="menuitem" title={isSelected && selectedCount > 1 ? `Remover ${selectedCount} componentes selecionados` : `Remover ${blockDisplayName}`} autoFocus onClick={(e) => { e.stopPropagation(); setMenuPosition(null); onRemoveBlock(block.id); }}>
            {isSelected && selectedCount > 1 ? `Remover ${selectedCount} componentes selecionados` : `Remover ${blockDisplayName}`}
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuPosition(null); frameRef.current?.focus(); }}>Cancelar</button>
        </div>, frameRef.current.closest(".cv-root")!
      )}
      {overlapping && isSelected && !isDragging && <span className="cv-overlap-warning" role="status">Sobreposição com outro bloco · mova ou redimensione</span>}
      {/* Origin Chip (Top-Left) */}
      <div
        className={`cv-origin-chip is-${originState}`}
        title={previewState?.data?.truncated && !showSampleData ? `${lineage || "Prévia"} · amostra limitada a ${previewState.data.rows.length.toLocaleString("pt-BR")} de ${previewState.data.total_rows.toLocaleString("pt-BR")} linhas (com os parâmetros atuais)` : lineage || (hasMissingSource ? "Nenhuma fonte associada ao bloco" : undefined)}
      >
        <span>{originLabel}</span>
        {canLoadPreview && blockSourceId && onLoadSourcePreview && (
          <button
            type="button"
            className="cv-origin-chip-action"
            onClick={(e) => {
              e.stopPropagation();
              onLoadSourcePreview(blockSourceId!);
            }}
          >
            Carregar prévia
          </button>
        )}
      </div>

      {/* Problem Badge in Top-Right */}
      {problem && (
        <button
          type="button"
          className={`cv-problem-badge is-${problem.severity}`}
          title={`${problem.severity === "error" ? "Erro" : "Aviso"}: ${problem.message}`}
          aria-label={`${problem.severity === "error" ? "Erro" : "Aviso"}: ${problem.message}`}
          onClick={(e) => {
            e.stopPropagation();
            onFocusBlock(block.id);
            onOpenProblem?.(problem);
          }}
        >
          !
        </button>
      )}

      {/* Floating Tooltip during Drag/Resize */}
      {isDragging && tempGeometry?.tooltip && (
        <div className="cv-drag-tooltip" aria-hidden="true">
          {tempGeometry.tooltip}
        </div>
      )}

      {/* Static Coordinates when Selected and Not Dragging */}
      {isSelected && !isDragging && (
        <span className="cv-block-coords">
          {Math.round(block.x)}, {Math.round(block.y)} · {Math.round(block.width)}×
          {Math.round(block.height)}
        </span>
      )}

      {!showSampleData && previewState?.status === "ready" && !!previewState.fields?.length && blockSourceId && <PreviewParameters compact key={JSON.stringify(previewState.values)} fields={previewState.fields} values={previewState.values || {}} onSubmit={parameters => onLoadSourcePreview?.(blockSourceId!, parameters)} />}
      {waitingForPreview ? (
        <div className="cv-block-inner"><div className="cv-block-status-inline" role="status">Carregando prévia…</div></div>
      ) : !showSampleData && previewState && previewState.status !== "ready" ? (
        <div className="cv-block-inner"><div className="cv-block-status-inline" role="status">
          <p>{previewState.status === "loading" ? "Carregando prévia…" : previewState.error}</p>
          {previewState.status !== "loading" && !!previewState.fields?.length && blockSourceId && <PreviewParameters key={JSON.stringify(previewState.values)} fields={previewState.fields} values={previewState.values || {}} onSubmit={parameters => onLoadSourcePreview?.(blockSourceId!, parameters)} />}
          {previewState.status !== "loading" && !previewState.fields?.length && blockSourceId && <button type="button" className="cv-btn-compact" onClick={() => onLoadSourcePreview?.(blockSourceId!)}>Tentar de novo</button>}
        </div></div>
      ) : !showSampleData && block.type !== "text" && block.type !== "image" && blockSourceId && localDatasets.has(blockSourceId) && !localDatasets.get(blockSourceId)?.rows.length ? (
        <div className="cv-block-inner"><div className="cv-block-status-inline" role="status"><p>Nenhuma linha neste período</p>{onLoadSourcePreview && sources.find(s => s.id === blockSourceId)?.type === "report" && <button type="button" className="cv-btn-compact" onClick={() => onLoadSourcePreview(blockSourceId!, expandedPreviewParameters(previewState?.fields || [], previewState?.values || {}))}>Ampliar para 90 dias</button>}</div></div>
      ) : <>
      {/* Block Preview Content or Inline Problem Message */}
      {problem && problem.severity === "error" && hasMissingSource ? (
        <div className="cv-block-inner">
          <div className="cv-block-problem-inline">
            <p className="cv-block-error-text">{problem.message}</p>
          </div>
        </div>
      ) : (
        <BlockPreview
          block={
            tempGeometry
              ? { ...block, x: currentX, y: currentY, width: currentW, height: currentH }
              : block
          }
          background={background}
          sources={sources}
          assets={assets}
          assetUrls={assetUrls}
          availableSources={availableSources}
          localDatasets={localDatasets}
          reportName={reportName}
          showSampleData={showSampleData}
        />
      )}

      </>}
      {/* 8 Resize Handles */}
      {isSelected && (
        <>
          {ALL_HANDLES.map((h) => (
            <button
              key={h.handle}
              type="button"
              tabIndex={-1}
              aria-keyshortcuts={h.handle === "se" ? "Alt+Shift+B" : undefined}
              onKeyDown={e => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
                e.preventDefault(); e.stopPropagation();
                const step = e.shiftKey ? 10 : 1;
                onKeyboardResize?.(block.id, e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
              }}
              aria-label={h.label}
              className={h.className}
              onPointerDown={(e) => onStartResize(e, block, h.handle)}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default memo(BlockFrameComponent, (prev, next) => {
  return (
    prev.onToggleBlock === next.onToggleBlock &&
    prev.onRemoveBlock === next.onRemoveBlock &&
    prev.onFocusBlock === next.onFocusBlock &&
    prev.selectedCount === next.selectedCount &&
    prev.overlapping === next.overlapping &&
    prev.previewState === next.previewState &&
    prev.isSelected === next.isSelected &&
    prev.isDragging === next.isDragging &&
    prev.background === next.background &&
    prev.showSampleData === next.showSampleData &&
    prev.pageName === next.pageName &&
    prev.pageIndex === next.pageIndex &&
    prev.problem === next.problem &&
    prev.tempGeometry === next.tempGeometry &&
    prev.sources === next.sources &&
    prev.assets === next.assets &&
    prev.assetUrls === next.assetUrls &&
    prev.availableSources === next.availableSources &&
    prev.localDatasets === next.localDatasets &&
    prev.reportName === next.reportName &&
    prev.block.id === next.block.id &&
    prev.block.type === next.block.type &&
    prev.block.x === next.block.x &&
    prev.block.y === next.block.y &&
    prev.block.width === next.block.width &&
    prev.block.height === next.block.height &&
    prev.block.title === next.block.title &&
    prev.block.text === next.block.text &&
    prev.block.source_id === next.block.source_id &&
    prev.block.asset_id === next.block.asset_id &&
    prev.block.options === next.block.options
  );
});
