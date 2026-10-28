import type { CanvasSource, CatalogSqlSource } from "../model";

export function friendlySourceName(source: CanvasSource, catalog?: CatalogSqlSource): string {
  if (source.label && source.label.toLowerCase() !== source.id.toLowerCase() && source.label.toLowerCase() !== "dados") return source.label.replace(/\s*[›»]\s*Dados\s*$/i, "");
  if (source.type === "report") return catalog?.name?.replace(/\s*[›»]\s*Dados\s*$/i, "") || "Tabela principal";
  return source.type === "inline" ? "Tabela manual" : "Metas mensais";
}
export function friendlySourceError(message: string, source: CanvasSource, catalog?: CatalogSqlSource): string {
  return message.replaceAll(`"${source.id}"`, `"${friendlySourceName(source, catalog)}"`).replace(/\s*[›»]\s*Dados\b/gi, "");
}
