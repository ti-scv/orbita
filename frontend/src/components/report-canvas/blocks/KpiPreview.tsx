import type { AggregateMode, CanvasBlock, CanvasSource, CatalogSqlSource } from "../model";
import { clamp } from "../model";

export interface KpiPreviewProps {
  block: CanvasBlock;
  source: CanvasSource;
  catalog?: CatalogSqlSource;
  dataset: { columns: string[]; rows: unknown[][] };
  fontSize: number;
  primaryColor: string;
  showSampleData: boolean;
}

function parseKpiNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  const direct = Number(s);
  if (Number.isFinite(direct)) return direct;
  const ptBr = s.replace(/\./g, "").replace(",", ".");
  const n = Number(ptBr);
  return Number.isFinite(n) ? n : null;
}

export default function KpiPreview({
  block,
  source,
  catalog,
  dataset,
  fontSize,
  primaryColor,
  showSampleData,
}: KpiPreviewProps) {
  const opt = block.options || {};
  const sourceLabel = catalog
    ? `${catalog.name} (${catalog.code})`
    : (source as any).label || (source.type === "report" ? `Relatório #${source.report_id}` : source.id);
  const unit = (opt as any).unit || (opt as any).suffix || "";

  if (source.type === "report" && !showSampleData && !dataset.columns.length) {
    return (
      <div className="cv-block-inner" title={`Fonte: ${sourceLabel || source.id}`}>
        {block.title && <div className="cv-block-title">{block.title}</div>}
        <div className="cv-kpi-body">
          <div className="cv-kpi-value" style={{ fontSize: `${fontSize}px`, color: primaryColor }}>
            —
          </div>
          <div className="cv-kpi-meta">
            <span className="cv-kpi-source" title={sourceLabel || source.id}>{source.id}</span>
            <span className="cv-kpi-sep">·</span>
            <span className="cv-kpi-aggregation">
              {opt.aggregate === "count" ? "Contagem" : opt.value_field || "coluna padrão"}
            </span>
          </div>
          <div className="cv-kpi-meta cv-kpi-sub" title={sourceLabel}>{sourceLabel}</div>
        </div>
      </div>
    );
  }

  const mode: AggregateMode = opt.aggregate || "sum";
  const precision = Math.round(clamp(Number(opt.precision) || 0, 0, 4));
  let val: number | null = null;
  const targetCol =
    opt.value_field || (dataset.columns.length > 1 ? dataset.columns[1] : dataset.columns[0]);

  if (mode === "count") {
    val = dataset.rows.length;
  } else if (dataset.rows.length > 0) {
    const colIdx = dataset.columns.indexOf(targetCol || "");
    if (colIdx >= 0) {
      const nums = dataset.rows
        .map((r) => parseKpiNumber(r[colIdx]))
        .filter((n): n is number => n !== null);
      if (nums.length > 0) {
        val = mode === "sum" ? nums.reduce((a, b) => a + b, 0) : nums[0];
      }
    }
  }

  const formatted =
    val === null
      ? "—"
      : mode === "count" && !opt.precision
        ? val.toLocaleString("pt-BR")
        : val.toLocaleString("pt-BR", {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
          });

  const aggregationLabel =
    mode === "count"
      ? "Contagem"
      : `${mode === "sum" ? "Soma" : "Primeiro"} (${targetCol || "—"})`;

  return (
    <div className="cv-block-inner" title={`Fonte: ${sourceLabel || source.id}`}>
      {block.title && <div className="cv-block-title">{block.title}</div>}
      <div className="cv-kpi-body">
        <div
          className="cv-kpi-value"
          style={{ fontSize: `${fontSize}px`, color: primaryColor }}
          title={formatted + (unit ? ` ${unit}` : "")}
        >
          {formatted}{unit ? ` ${unit}` : ""}
        </div>
        <div className="cv-kpi-meta">
          <span className="cv-kpi-source" title={sourceLabel || source.id}>
            {source.id}
          </span>
          <span className="cv-kpi-sep">·</span>
          <span className="cv-kpi-aggregation">{aggregationLabel}</span>
        </div>
        {sourceLabel && (
          <div className="cv-kpi-meta cv-kpi-sub" title={sourceLabel}>
            {sourceLabel}
          </div>
        )}
      </div>
    </div>
  );
}
