import { friendlySourceName } from "../data/sourceName";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, Database } from "lucide-react";
import type { CanvasBlock, CanvasSource, CatalogSqlSource } from "../model";
import { BLOCK_LABELS, clamp } from "../model";
import { displayCanvasValue } from "../common/displayValue";
import { GroupingError, groupByCategorical, groupByDate, parseNumericValue } from "../stage/dataGrouping";

import { resolveSeriesPalette } from "./chartPalette";
export interface ChartPreviewProps {
  block: CanvasBlock;
  source: CanvasSource;
  catalog?: CatalogSqlSource;
  dataset: { columns: string[]; rows: unknown[][] };
  primaryColor: string;
  axisColor: string;
  gridColor: string;
  showSampleData: boolean;
}

export default function ChartPreview({
  block,
  source,
  catalog,
  dataset,
  primaryColor,
  axisColor,
  gridColor,
  showSampleData,
}: ChartPreviewProps) {
  const opt = block.options || {};
  const sourceLabel = friendlySourceName(source, catalog);

  if (source.type === "report" && !showSampleData && !dataset.columns.length) {
    return (
      <div className="cv-block-inner" title={`Fonte: ${sourceLabel}`}>
        {block.title && <div className="cv-block-title">{block.title}</div>}
        <div className="cv-sql-placeholder">
          <span className="cv-sql-badge" style={{ color: primaryColor }}>
            <Database size={11} />
            {BLOCK_LABELS[block.type]} · Dados
          </span>
          <span className="cv-sql-meta">{sourceLabel}</span>
          <span className="cv-sql-meta">
            Eixo X: <strong>{opt.x_field || "1ª coluna"}</strong> · Série(s):{" "}
            <strong>{opt.y_fields?.length ? opt.y_fields.join(", ") : "2ª coluna"}</strong>
          </span>
          <div className="cv-wireframe-bars" aria-hidden="true">
            <span style={{ height: "45%", background: primaryColor }} />
            <span style={{ height: "75%", background: primaryColor }} />
            <span style={{ height: "60%", background: "#14b4cb" }} />
            <span style={{ height: "92%", background: primaryColor }} />
          </div>
        </div>
      </div>
    );
  }

  const xCol =
    opt.x_field && dataset.columns.includes(opt.x_field) ? opt.x_field : dataset.columns[0];
  const rawYs = opt.y_fields?.length ? opt.y_fields : dataset.columns.slice(1, 2);
  const yCols = rawYs.filter((c) => dataset.columns.includes(c)).slice(0, 6);
  const xIdx = xCol ? dataset.columns.indexOf(xCol) : -1;
  const yIndices = yCols.map((c) => dataset.columns.indexOf(c));

  if (xIdx < 0 || yCols.length === 0 || dataset.rows.length === 0) {
    return (
      <div className="cv-block-inner" title={`Fonte: ${sourceLabel}`}>
        {block.title && <div className="cv-block-title">{block.title}</div>}
        <div className="cv-sql-placeholder">
          <span className="cv-sql-badge">
            {BLOCK_LABELS[block.type]} · {sourceLabel}
          </span>
          <span className="cv-sql-meta">{sourceLabel}</span>
          <span className="cv-sql-meta">
            {dataset.rows.length === 0
              ? source.type === "goals"
                ? "Sem metas mensais cadastradas neste relatório."
                : "Fonte sem linhas para prévia."
              : "Ajuste o eixo X e as séries numéricas no inspetor."}
          </span>
        </div>
      </div>
    );
  }

  let processedRows: (string | number | null)[][];
  try {
    if (opt.x_group) {
      const res = groupByDate({
        rows: dataset.rows,
        xColIndex: xIdx,
        yColIndices: yIndices,
        groupMode: opt.x_group as "day" | "week" | "month" | "quarter" | "year",
        aggMode: (opt.y_aggregate as "sum" | "avg" | "count" | "min" | "max") || "sum",
        seriesNames: yCols,
        blockLabel: block.title || block.id,
        xColName: xCol,
        chartType: block.type,
      });
      processedRows = res.rows;
    } else if (opt.y_aggregate) {
      const res = groupByCategorical({
        rows: dataset.rows,
        xColIndex: xIdx,
        yColIndices: yIndices,
        aggMode: opt.y_aggregate as "sum" | "avg" | "count" | "min" | "max",
        seriesNames: yCols,
        blockLabel: block.title || block.id,
        chartType: block.type,
      });
      processedRows = res.rows;
    } else {
      if (dataset.rows.length > 500) {
        throw new GroupingError(
          `Gráfico "${block.title || block.id}": aceita até 500 pontos, mas gerou ${dataset.rows.length} pontos. Agrupe por mês ou semana para reduzir os dados.`,
          "chart_points_limit",
        );
      }
      processedRows = dataset.rows.map((r) => [
        displayCanvasValue(r[xIdx]),
        ...yIndices.map((yi, idx) =>
          parseNumericValue(r[yi], yCols[idx], block.title || block.id),
        ),
      ]);
      if (block.type === "pie") {
        for (const pr of processedRows) {
          if (typeof pr[1] === "number" && pr[1] < 0) {
            throw new GroupingError(
              `Gráfico "${block.title || block.id}": gráfico de pizza não aceita valores negativos.`,
              "pie_negative_value",
            );
          }
        }
      }
    }
  } catch (err) {
    return (
      <div className="cv-block-inner" title={`Fonte: ${sourceLabel}`}>
        {block.title && <div className="cv-block-title">{block.title}</div>}
        <div className="cv-block-error-card">
          <AlertCircle size={16} aria-hidden="true" />
          <p className="cv-block-error-text">
            {(err as Error).message || "Erro nos dados do gráfico."}
          </p>
        </div>
      </div>
    );
  }

  if (processedRows.length === 0) {
    return (
      <div className="cv-block-inner" title={`Fonte: ${sourceLabel}`}>
        {block.title && <div className="cv-block-title">{block.title}</div>}
        <div className="cv-sql-placeholder">
          <span className="cv-sql-badge">
            {BLOCK_LABELS[block.type]} · {sourceLabel}
          </span>
          <span className="cv-sql-meta">{sourceLabel}</span>
          <span className="cv-sql-meta">Nenhum dado para exibir neste período.</span>
        </div>
      </div>
    );
  }

  const chartData = processedRows.map((r) => {
    const item: Record<string, string | number | null> = {
      __x: String(r[0] ?? ""),
    };
    yCols.forEach((yc, idx) => {
      item[yc] = (r[idx + 1] as number | null) ?? null;
    });
    return item;
  });

  // Reserve room for every category label; the block can scroll when needed.
  const labelWidth = Math.max(50, ...chartData.map((row) => String(row.__x).length * 6 + 12));
  const chartW = Math.max(180, Math.floor(block.width - 24), block.type === "pie" ? 0 : labelWidth * chartData.length + 150);
  const chartH = Math.max(150, Math.floor(block.height - (block.title ? 44 : 20)));
  const legendItems = block.type === "pie"
    ? chartData.filter((row) => typeof row[yCols[0]] === "number" && Number(row[yCols[0]]) >= 0).map((row) => String(row.__x))
    : yCols.length > 1 ? yCols : [];
  const axisWidth = Math.max(80, ...chartData.flatMap((row) =>
    yCols.map((column) => typeof row[column] === "number" ? Number(row[column]).toLocaleString("pt-BR").length * 7 + 12 : 0),
  ));
  const palette = resolveSeriesPalette(opt.color, opt.series_colors, block.type);

  const precision =
    typeof opt.precision === "number" ? Math.round(clamp(opt.precision, 0, 4)) : undefined;

  const formatTooltipValue = (val: unknown): string => {
    if (typeof val !== "number" || !Number.isFinite(val)) return String(val ?? "—");
    return precision !== undefined
      ? val.toLocaleString("pt-BR", {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        })
      : val.toLocaleString("pt-BR");
  };

  const isDark = axisColor === "#bdbdbd";
  const tooltipContentStyle = {
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    borderColor: gridColor,
    color: isDark ? "#f1f5f9" : "#1e293b",
    fontSize: "11px",
    borderRadius: "6px",
    padding: "4px 8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  };
  const tooltipItemStyle = {
    color: isDark ? "#f1f5f9" : "#1e293b",
  };

  return (
    <div className="cv-block-inner" title={`Fonte: ${sourceLabel}`}>
      {block.title && <div className="cv-block-title">{block.title}</div>}
      <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "100%", pointerEvents: "auto" }}>
      <div style={{ width: chartW, height: chartH }}>
        {block.type === "bar" && (
          <BarChart
            width={chartW}
            height={chartH}
            data={chartData}
            margin={{ top: 6, right: 16, bottom: 2, left: 4 }}
          >
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="__x"
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={axisWidth}
              tickFormatter={(v: any) =>
                typeof v === "number" ? v.toLocaleString("pt-BR") : String(v ?? "")
              }
            />
            <Tooltip
              formatter={(val: any, name: any) => [formatTooltipValue(val), name]}
              labelFormatter={(label: any) => displayCanvasValue(label)}
              contentStyle={tooltipContentStyle}
              itemStyle={tooltipItemStyle}
            />

            {yCols.map((yc, i) => (
              <Bar
                key={yc}
                dataKey={yc}
                name={yc}
                fill={palette[i % palette.length]}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
        {block.type === "line" && (
          <LineChart
            width={chartW}
            height={chartH}
            data={chartData}
            margin={{ top: 6, right: 16, bottom: 2, left: 4 }}
          >
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="__x"
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={axisWidth}
              tickFormatter={(v: any) =>
                typeof v === "number" ? v.toLocaleString("pt-BR") : String(v ?? "")
              }
            />
            <Tooltip
              formatter={(val: any, name: any) => [formatTooltipValue(val), name]}
              labelFormatter={(label: any) => displayCanvasValue(label)}
              contentStyle={tooltipContentStyle}
              itemStyle={tooltipItemStyle}
            />

            {yCols.map((yc, i) => (
              <Line
                key={yc}
                type="monotone"
                dataKey={yc}
                name={yc}
                stroke={palette[i % palette.length]}
                strokeWidth={2}
                dot={{ r: 2.5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        )}
        {block.type === "pie" &&
          (() => {
            const pieData = chartData.filter(
              (d) => typeof d[yCols[0]] === "number" && Number(d[yCols[0]]) >= 0,
            );
            if (pieData.length === 0 || pieData.every((d) => Number(d[yCols[0]]) === 0)) {
              return (
                <div className="cv-sql-placeholder">
                  <span className="cv-sql-badge">
                    {BLOCK_LABELS[block.type]} · {sourceLabel}
                  </span>
                  <span className="cv-sql-meta">{sourceLabel}</span>
                  <span className="cv-sql-meta">
                    Sem valores numéricos maiores que zero para exibir no gráfico de pizza.
                  </span>
                </div>
              );
            }
            return (
              <PieChart width={chartW} height={chartH}>
                <Pie
                  data={pieData}
                  dataKey={yCols[0]}
                  nameKey="__x"
                  cx="50%"
                  cy="50%"
                  outerRadius={Math.max(22, Math.floor(Math.min(chartW, chartH) * 0.36))}
                  isAnimationActive={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [
                    formatTooltipValue(val),
                    displayCanvasValue(name),
                  ]}
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                />

              </PieChart>
            );
          })()}
      </div>
      {legendItems.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", color: axisColor, fontSize: 10 }}>
          {legendItems.map((label, i) => (
            <span key={i} style={{ overflowWrap: "anywhere" }}>
              <span aria-hidden="true" style={{ color: palette[i % palette.length] }}>● </span>{label}
            </span>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
