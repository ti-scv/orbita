import { useState } from "react";
import type { CanvasLayout, ParameterDeclaration, ParameterEdit } from "../model";

export default function ParameterEditor({ items, edits, onChange, layout }: { layout?: CanvasLayout; items: ParameterDeclaration[]; edits: ParameterEdit[]; onChange: (edits: ParameterEdit[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const visible = items.filter(i => !edits.some(e => e.name === i.name)).map(item => {
    if (!layout) return item;
    const uses = item.uses.filter(use => !use.startsWith("Fonte ") && !use.startsWith("Bloco "));
    for (const source of layout.sources) if (source.type === "report") {
      for (const [key, value] of Object.entries(source.parameters || {})) {
        if ((typeof value === "object" && value !== null && "parameter" in value && value.parameter === item.name) || (!item.historical && key === item.name)) uses.push(`Fonte ${source.label || source.id}: ${key}`);
      }
    }
    for (const page of layout.pages) for (const block of page.blocks) {
      for (const match of (block.text || "").matchAll(/{{\s*([^}]+?)\s*}}/g)) if (match[1] === item.name) uses.push(`Bloco ${block.title || block.id}`);
    }
    return {...item, uses, status: item.status === "Duplicado" || item.suggestion ? item.status : uses.length ? "Usado" : "Não usado"};
  });
  function remove(names: string[]) {
    const rows = visible.filter(i => names.includes(i.name) && !i.uses.length);
    const warning = "Excluir " + rows.length + " parâmetro(s) não usado(s): " + rows.map(i => i.name).join(", ") + "?";
    if (rows.length && window.confirm(warning)) { onChange([...edits, ...rows.map(i => ({ name: i.name }))]); setSelected([]); }
  }
  return <section className="cv-parameter-editor" aria-label="Parâmetros do relatório">
    <button type="button" className="cv-btn-compact" aria-expanded={open} onClick={() => setOpen(!open)}>Editar parâmetros ({visible.length})</button>
    {open && <div className="cv-parameter-body">
      {visible.some(i => !i.uses.length) && <button type="button" className="cv-btn-compact" onClick={() => setSelected(visible.filter(i => !i.uses.length).map(i => i.name))}>Selecionar não usados</button>}
      <p>{selected.length ? `${selected.length} selecionados: ${selected.join(", ")}. ` : ""}Alterações serão gravadas ao salvar o relatório.</p>
      <button type="button" className="cv-btn-compact" disabled={!selected.length} onClick={() => remove(selected)}>Excluir selecionados</button>
      {visible.map(i => <div className="cv-parameter-row" key={i.name}>
        {i.uses.length ? <span title="Em uso: remova dos blocos antes de excluir" aria-label="Em uso: remova dos blocos antes de excluir">🔒</span> : <input type="checkbox" aria-label={`Selecionar ${i.name}`} checked={selected.includes(i.name)} onChange={e => setSelected(e.target.checked ? [...selected, i.name] : selected.filter(n => n !== i.name))} />}
        <strong>{i.name}</strong>
        <span className="cv-chip" title={i.uses.join("; ")}>{i.uses.length ? `Usado em ${i.uses.length} ${i.uses.length === 1 ? "local" : "locais"}` : "Não usado"}</span>
        {!i.uses.length && <button type="button" className="cv-btn-compact" title="Excluir parâmetro" aria-label={`Excluir parâmetro ${i.name}`} onClick={() => remove([i.name])}>✕</button>}
        {i.suggestion && <button type="button" className="cv-btn-compact" onClick={() => { if (window.confirm(`Renomear ${i.name} para ${i.suggestion}? Isso altera apenas o cadastro legado; não reescreve consultas.`)) onChange([...edits, { name: i.name, rename: i.suggestion }]); }}>Renomear para {i.suggestion}</button>}
      </div>)}
      {!!edits.length && <><p>Rascunho: {edits.map(e => e.rename ? `${e.name} → ${e.rename}` : `Excluir ${e.name}`).join("; ")}</p><button type="button" className="cv-btn-compact" onClick={() => onChange([])}>Desfazer alterações dos parâmetros</button></>}
    </div>}
  </section>;
}
