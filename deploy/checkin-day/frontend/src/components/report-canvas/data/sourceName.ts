import { canvasErrorMessage } from "../common/errorMessage";
import type { CanvasSource, CatalogSqlSource } from "../model";

export function friendlySourceName(source: CanvasSource, catalog?: CatalogSqlSource): string {
  if (source.label && !/^(dados|contacts|not-sent|confirmed|ame|appointment|start|end|unidade|tipo_envio)$/i.test(source.label) && source.label.toLowerCase() !== source.id.toLowerCase()) return source.label.replace(/\s*[›»]\s*Dados\s*$/i, "");
  if (source.type === "report") return catalog?.name?.replace(/\s*[›»]\s*Dados\s*$/i, "") || "Tabela principal";
  return source.type === "inline" ? "Tabela manual" : "Metas mensais";
}
export function friendlySourceError(message: string, source: CanvasSource, catalog?: CatalogSqlSource): string {
  const escaped = source.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return canvasErrorMessage(message.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "gi"), () => friendlySourceName(source, catalog)).replace(/\s*[›»]\s*Dados\b/gi, ""));
}
