import { useState } from "react";
import type { ParameterDeclaration, ParameterEdit } from "../model";

export default function ParameterEditor({ items, edits, onChange }: { items: ParameterDeclaration[]; edits: ParameterEdit[]; onChange: (edits: ParameterEdit[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const visible = items.filter(i => !edits.some(e => e.name === i.name));
  function remove(names: string[]) {
    const rows = visible.filter(i => names.includes(i.name));
    const used = rows.filter(i => i.uses.length);
    const warning = used.length ? "Atenção: a exclusão pode interromper a consulta, a validação e os blocos indicados:\n" + used.map(i => i.name + ": " + i.uses.join("; ")).join("\n") + "\nConfirmar mesmo assim?" : "Excluir " + rows.length + " parâmetro(s) não usado(s): " + names.join(", ") + "?";
    if (rows.length && window.confirm(warning)) { onChange([...edits, ...rows.map(i => ({ name: i.name }))]); setSelected([]); }
  }
  return <section aria-label="Parâmetros do relatório">
    <button type="button" className="cv-btn-compact" aria-expanded={open} onClick={() => setOpen(!open)}>Editar parâmetros ({visible.length})</button>
    {open && <div>
      <button type="button" className="cv-btn-compact" onClick={() => setSelected(visible.filter(i => i.status === "Não usado").map(i => i.name))}>Selecionar todos os não usados</button>
      <p role="status">{selected.length} selecionado(s): {selected.join(", ") || "nenhum"}. Alterações só serão gravadas ao salvar o relatório.</p>
      <button type="button" className="cv-btn-compact" disabled={!selected.length} onClick={() => remove(selected)}>Excluir selecionados</button>
      {visible.map(i => <div key={i.name}>
        <label><input type="checkbox" checked={selected.includes(i.name)} onChange={e => setSelected(e.target.checked ? [...selected, i.name] : selected.filter(n => n !== i.name))} />{i.name}</label>
        <span className="cv-chip">{i.status}</span>
        <p>{i.uses.length ? "Onde é usado: " + i.uses.join("; ") : "Sem consumidor atual comprovado"}{i.historical ? " · Cadastro legado" : ""}</p>
        <button type="button" className="cv-btn-compact" aria-label={`Excluir parâmetro ${i.name}`} onClick={() => remove([i.name])}>Excluir</button>
        {i.suggestion && <button type="button" className="cv-btn-compact" onClick={() => { if (window.confirm(`Renomear ${i.name} para ${i.suggestion}? Isso altera apenas o cadastro legado; não reescreve consultas.`)) onChange([...edits, { name: i.name, rename: i.suggestion }]); }}>Renomear para {i.suggestion}</button>}
      </div>)}
      {!!edits.length && <><p role="status">Rascunho: {edits.map(e => e.rename ? `${e.name} → ${e.rename}` : `Excluir ${e.name}`).join("; ")}</p><button type="button" className="cv-btn-compact" onClick={() => onChange([])}>Desfazer alterações dos parâmetros</button></>}
    </div>}
  </section>;
}
