import type { ColumnDataType, ColumnInfo } from "../model";
import { displayCanvasValue } from "../common/displayValue";

export type { ColumnDataType, ColumnInfo };

export const COLUMN_TYPE_LABELS: Record<ColumnDataType, string> = {
  number: "Número",
  date: "Data",
  datetime: "Data e hora",
  boolean: "Sim/Não",
  text: "Texto",
  unknown: "Tipo não detectado",
};

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
export const NUMERIC_STRING_RE = /^-?\d+(?:\.\d+)?$/;

export function inferValueType(val: unknown): ColumnDataType {
  if (val === null || val === undefined || val === "") return "unknown";
  if (typeof val === "number" && Number.isFinite(val)) return "number";
  if (typeof val === "boolean") return "boolean";
  if (val instanceof Date) return "date";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.toLowerCase() === "true" || trimmed.toLowerCase() === "false") return "boolean";
    if (ISO_DATE_RE.test(trimmed) || /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return "date";
    if (ISO_DATETIME_RE.test(trimmed)) return "datetime";
    if (NUMERIC_STRING_RE.test(trimmed)) return "number";
    return "text";
  }
  return "text";
}

export function inferColumnType(values: unknown[]): ColumnDataType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (!nonNull.length) return "unknown";

  let numCount = 0;
  let dateCount = 0;
  let datetimeCount = 0;
  let boolCount = 0;

  for (const v of nonNull) {
    const t = inferValueType(v);
    if (t === "number") numCount++;
    else if (t === "date") dateCount++;
    else if (t === "datetime") datetimeCount++;
    else if (t === "boolean") boolCount++;
  }

  const total = nonNull.length;
  if (numCount / total >= 0.9) return "number";
  if (datetimeCount / total >= 0.9) return "datetime";
  if ((dateCount + datetimeCount) / total >= 0.9) return "date";
  if (boolCount / total >= 0.9) return "boolean";
  return "text";
}

export function formatCellValue(val: unknown, type?: ColumnDataType): string {
  if (val == null || (typeof val === "string" && !val.trim())) return "—";

  if (type === "number" || (type === undefined && typeof val === "number")) {
    const num = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(num)) return "—";
    if (Number.isInteger(num)) return num.toLocaleString("pt-BR");
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 4 });
  }

  // Share date validation and wall-clock formatting with block previews.
  if (type === "date" && val instanceof Date) {
    return Number.isFinite(val.getTime()) ? val.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
  }
  if (
    type === "date" || type === "datetime" ||
    (typeof val === "string" && (ISO_DATE_RE.test(val.trim()) || ISO_DATETIME_RE.test(val.trim())))
  ) {
    return displayCanvasValue(typeof val === "string" ? val.trim() : val);
  }

  if (type === "boolean" || typeof val === "boolean") {
    if (val === true || val === "true") return "Sim";
    if (val === false || val === "false") return "Não";
  }

  const states: Record<string, string> = { not_requested: "Não solicitado", answered: "Respondido", confirmed: "Confirmado", scheduled: "Agendado", done: "Concluído", delivered: "Entregue", read: "Lido", no_answer: "Sem resposta", no_response: "Sem resposta", unanswered: "Sem resposta", not_answered: "Não atendido", declined: "Recusado", review: "Em revisão", assigned: "Em atendimento", waiting_external: "Aguardando ação externa", pending_external: "Aguardando ação externa", preview: "Somente análise", queued: "Na fila", sending: "Enviando", accepted: "Aceito", uncertain: "Resultado incerto", blocked: "Bloqueado", expired: "Vencido", running: "Em execução", ready: "Pronto", missed: "Perdido", draft: "Rascunho", pending: "Pendente", open: "Aberto", closed: "Fechado", completed: "Concluído", cancelled: "Cancelado", canceled: "Cancelado", sent: "Enviado", failed: "Falhou" };
  return typeof val === "string" ? states[val.trim().toLowerCase()] || (val.includes("_") ? val.replaceAll("_", " ").replace(/^./, c => c.toLocaleUpperCase("pt-BR")) : val) : String(val);
}

export function formatColumnTypeLabel(type?: ColumnDataType, looksLike?: string): string {
  if (!type || type === "unknown") return "Tipo não detectado";
  const base = COLUMN_TYPE_LABELS[type] || type;
  if (looksLike && looksLike !== type) {
    const hint = COLUMN_TYPE_LABELS[looksLike as ColumnDataType] || looksLike;
    return `${base} (${hint} inferido)`;
  }
  return base;
}

export function getColumnTypeAriaLabel(type?: ColumnDataType, looksLike?: string): string {
  if (!type || type === "unknown") return "Coluna com tipo não detectado";
  const label = formatColumnTypeLabel(type, looksLike);
  return `Tipo de dado: ${label}`;
}
