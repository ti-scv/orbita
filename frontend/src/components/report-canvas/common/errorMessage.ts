// Backend errors are untrusted presentation text. Keep technical tokens out of the UI.
const names: Record<string, string> = {
  contacts: "Acompanhamentos e contatos", "not-sent": "Agendamentos sem envio",
  confirmed: "Agendamentos confirmados", ame: "AME Votuporanga", appointment: "Agendamento",
  start: "Data inicial", end: "Data final", unidade: "Unidade", tipo_envio: "Tipo de envio",
};
export function canvasErrorMessage(value: unknown, requestBody?: unknown, status?: number): string {
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if (status === 403) return "Você não tem permissão para esta operação. Confira seu acesso e tente novamente.";
  if (status === 404) return "O relatório ou a fonte não foi encontrado. Confira a seleção e tente novamente.";
  if (status === 429) return "Há muitas consultas em andamento. Aguarde um instante e tente novamente.";
  if (status && status >= 500) return "O servidor está temporariamente indisponível. Tente novamente em instantes.";
  const flatten = (item: unknown): string[] => typeof item === "string" ? [item] : Array.isArray(item) ? item.flatMap(flatten) : item && typeof item === "object" ? "detail" in item ? flatten((item as Record<string, unknown>).detail) : Object.entries(item).filter(([key]) => !["code", "source_id", "block_id", "line", "column"].includes(key)).flatMap(([, child]) => flatten(child)) : [];
  let payload = requestBody as {source?: {id?:string;label?:string};layout?:{sources?: Array<{id?:string;label?:string}>};json?:string} | undefined;
  if (payload?.json) { try { payload = {...payload, layout: JSON.parse(payload.json)}; } catch { /* Invalid local JSON is handled before requesting validation. */ } }
  const layoutSources = payload?.layout?.sources;
  const sourceList = payload?.source ? [payload.source] : Array.isArray(layoutSources) ? layoutSources : [];
  let text = flatten(value).join(" ").replace(/\s*[›»]\s*Dados\b/gi, "");
  for (const source of sourceList) {
    if (!source || typeof source.id !== "string" || !source.id) continue;
    const escaped = source.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const label = typeof source.label === "string" && source.label !== source.id ? source.label.replace(/\s*[›»]\s*Dados\b/gi, "") : "Tabela principal";
    text = text.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g"), () => label);
  }
  if (/This field|Invalid |Not found|Internal Server Error|Traceback|ProgrammingError|OperationalError|does not exist|not permitted|Permission denied|Authentication|CSRF|must be|required|valid choice|valid integer|Unsupported media type/i.test(text)) return "Não foi possível concluir a operação. Confira os campos e tente novamente.";
  if (!text) return "Não foi possível concluir a operação. Confira os campos e tente novamente.";
  // Preserve the explicitly quoted missing parameter, which is actionable in advanced editing.
  const missing = /(?:parâmetro (?:inexistente|desconhecido|não (?:encontrado|declarado))\s*(["'][^"']+["'])|parâmetro\s*(["'][^"']+["'])\s*não existe)/i.exec(text);
  const missingToken = missing?.[1] || missing?.[2];
  const protectedText = missingToken ? text.replace(missingToken, "\u0000") : text;
  const translated = protectedText.replace(/\b(contacts|not-sent|confirmed|ame|appointment|start|end|unidade|tipo_envio)\b/gi, token => names[token.toLowerCase()])
    .replace(/(["'])dados\1/gi, '"Tabela principal"').replace(/\bfonte\s+dados\b/gi, 'fonte Tabela principal');
  return missingToken ? translated.replace("\u0000", missingToken) : translated;
}
