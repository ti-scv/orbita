import { Calendar, Clock } from "lucide-react";
import type { ColumnDataType } from "../model";
import { formatColumnTypeLabel, getColumnTypeAriaLabel } from "./columnTypes";

export interface ColumnBadgeProps {
  type?: ColumnDataType;
  looksLike?: string;
  className?: string;
  estimated?: boolean;
}

export default function ColumnBadge({ type = "unknown", looksLike, className = "", estimated = false }: ColumnBadgeProps) {
  const ariaLabel = getColumnTypeAriaLabel(type, looksLike);
  const title = formatColumnTypeLabel(type, looksLike) + (estimated ? " (estimado pelo esquema)" : "");
  const modClass = `is-${type}`;

  return (
    <span
      className={`cv-type-badge ${modClass} ${className}`.trim()}
      role="img"
      aria-label={ariaLabel + (estimated ? " (estimado pelo esquema)" : "")}
      title={title}
    >
      {type === "number" && (
        <span className="cv-type-glyph num" aria-hidden="true">
          123
        </span>
      )}
      {type === "date" && <Calendar size={12} aria-hidden="true" />}
      {type === "datetime" && <Clock size={12} aria-hidden="true" />}
      {type === "boolean" && (
        <span className="cv-type-glyph bool" aria-hidden="true">
          ✓/✗
        </span>
      )}
      {type === "text" && (
        <span className="cv-type-glyph txt" aria-hidden="true">
          Aa
        </span>
      )}
      {type === "unknown" && (
        <span className="cv-type-glyph unk" aria-hidden="true">
          —
        </span>
      )}
    </span>
  );
}
