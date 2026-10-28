import type { CanvasSource, CatalogSqlSource } from "../model";

export function friendlySourceName(source: CanvasSource, catalog?: CatalogSqlSource): string {
  if (source.label && source.label.toLowerCase() !== source.id.toLowerCase() && source.label.toLowerCase() !== "dados") return source.label;
  if (source.type === "report") return `${catalog?.name || "Relatório"} › ${catalog?.datasets?.find(item => item.id === source.dataset)?.name || "Dados"}`;
  return source.type === "inline" ? "Tabela manual" : "Metas mensais";
}
export function friendlySourceError(message: string, source: CanvasSource, catalog?: CatalogSqlSource): string {
  return message.replaceAll(`Fonte "${source.id}"`, `Fonte "${friendlySourceName(source, catalog)}"`);
}
