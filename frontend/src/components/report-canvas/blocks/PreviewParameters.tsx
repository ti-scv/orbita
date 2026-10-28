import { useState } from "react";
import { collectTestParameters } from "../parameters";
import type { TestParameter } from "../parameters";

export default function PreviewParameters({fields, values, onSubmit, compact = false}: {
  compact?: boolean; fields: TestParameter[]; values: Record<string,string>; onSubmit: (parameters: Record<string,unknown>) => void;
}) {
  const [draft, setDraft] = useState(values);
  const [error, setError] = useState("");
  const form = <form className="cv-preview-parameters" onSubmit={event => {
    event.preventDefault(); event.stopPropagation();
    try { const parameters = collectTestParameters(fields, draft); setError(""); onSubmit(parameters); }
    catch (err) { setError((err as Error).message); }
  }}>
    {fields.map(field => <label key={field.name}>{field.label}{field.required !== false && field.default == null ? " *" : ""}
      {field.options ? <select value={draft[field.name] || ""} onChange={e => setDraft({...draft, [field.name]: e.target.value})}><option value="">Selecione</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        : <input type={field.type === "date" ? "date" : "text"} title={field.type === "date" ? "DD/MM/AAAA na tela; AAAA-MM-DD ao enviar" : undefined} value={field.type === "date" ? (draft[field.name] || "").replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1") : draft[field.name] || ""} placeholder={field.type === "date" ? "DD/MM/AAAA" : undefined} onChange={e => setDraft({...draft, [field.name]: e.target.value})} />}
    </label>)}
    {error && <p role="alert">{error}</p>}
    <button type="submit" className="cv-btn-compact">{compact ? "Consultar prévia" : "Tentar de novo"}</button>
    <small>Parâmetros só desta prévia · sem salvar</small>
  </form>;
  return compact ? <details className="cv-preview-controls" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}><summary>Alterar período / filtros</summary>{form}</details> : form;
}
