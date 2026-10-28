import { useEffect, useState } from "react";
import InlineDialog from "../../InlineDialog";
import type { CanvasLayout } from "../model";

export default function JsonEditorDialog({ layout, validate, onApply, onUndo, canUndo, onClose }: {
  layout: CanvasLayout; validate: (text: string) => Promise<CanvasLayout>; onApply: (layout: CanvasLayout) => void; onUndo: () => void; canUndo: boolean; onClose: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(layout, null, 2));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(JSON.stringify(layout, null, 2)); setError(""); }, [layout]);
  const close = () => { if (text === JSON.stringify(layout, null, 2) || window.confirm("Descartar o texto JSON ainda não aplicado?")) onClose(); };
  async function apply() {
    setBusy(true); setError("");
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new Error("JSON inválido. Confira a sintaxe antes de validar."); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray((parsed as CanvasLayout).pages) || !Array.isArray((parsed as CanvasLayout).sources)) throw new Error("O JSON precisa conter as listas de páginas e fontes.");
      const next = await validate(text);
      if (window.confirm("Aplicar o JSON ao rascunho do canvas? O relatório só será gravado ao usar Salvar.")) onApply(next);
    } catch (exc) { setError((exc as Error).message); }
    finally { setBusy(false); }
  }
  return <InlineDialog title="JSON do canvas" subtitle="Modo avançado · alterações no rascunho" busy={busy} onClose={close} className="cv-root" footer={<>
    <button type="button" className="cv-btn-compact" disabled={busy} onClick={() => { setText(JSON.stringify(layout, null, 2)); setError(""); }}>Desfazer edição do texto</button>
    <button type="button" className="cv-btn-compact" disabled={busy || !canUndo} onClick={onUndo}>Desfazer aplicação</button>
    <button type="button" className="cv-btn-compact primary" disabled={busy} onClick={() => void apply()}>Validar e aplicar</button>
  </>}>
    <label htmlFor="canvas-json-text">JSON do canvas</label>
    <textarea id="canvas-json-text" aria-describedby={error ? "canvas-json-error" : undefined} aria-invalid={!!error} spellCheck={false} value={text} onChange={e => setText(e.target.value)} style={{width:"100%", minHeight:"50vh", fontFamily:"monospace", resize:"vertical"}} />
    {error && <p id="canvas-json-error" role="alert">{error}</p>}
  </InlineDialog>;
}
