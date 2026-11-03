import type { SourcePreview } from "../model";

export function formatRowCount(shown: number, preview: Pick<SourcePreview, "total_rows" | "total_rows_exact" | "total_rows_capped">): string {
  const qualifier = preview.total_rows_capped ? "mais de " : preview.total_rows_exact === false ? "pelo menos " : "";
  return `${shown.toLocaleString("pt-BR")} de ${qualifier}${preview.total_rows.toLocaleString("pt-BR")} linhas`;
}
