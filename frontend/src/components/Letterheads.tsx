import { useEffect, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { query, request } from "../api";
import InlineDialog from "./InlineDialog";

type Field = {
  type: string;
  text: string;
  x: number;
  y: number;
  font_size: number;
  align: string;
  font?: string;
};
type Letterhead = {
  id?: number;
  name: string;
  active: boolean;
  background: string;
  background_landscape: string;
  margins: Record<string, number>;
  fields: Field[];
};
const empty = (): Letterhead => ({
  name: "",
  active: true,
  background: "",
  background_landscape: "",
  margins: { top: 25, bottom: 20, left: 15, right: 15 },
  fields: [],
});
const labels: Record<string, string> = {
  title: "Título",
  date: "Data de geração",
  period: "Período",
  unit: "Unidade",
  user: "Usuário",
  page: "Página",
  text: "Texto livre",
};

export default function Letterheads({ unit }: { unit: string }) {
  const [landscape, setLandscape] = useState(false);
  const [rows, setRows] = useState<Letterhead[]>([]),
    [edit, setEdit] = useState<Letterhead | null>(null),
    [remove, setRemove] = useState<Letterhead | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const url = (id?: number) =>
    query(`letterheads${id ? `/${id}` : ""}`, { unit });
  async function load() {
    const result: Letterhead[] = [];
    for (let page = 1; page <= 100; page++) {
      const data = await request<{
        results: Letterhead[];
        next: string | null;
      }>(query("letterheads", { unit, page: String(page) }));
      result.push(...data.results);
      if (!data.next) {
        setRows(result);
        return;
      }
    }
    throw new Error("Limite de registros excedido.");
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [unit]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      await request(url(edit.id), edit.id ? "PATCH" : "POST", edit);
      await load();
      setEdit(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function destroy() {
    if (!remove?.id) return;
    setBusy(true);
    setError("");
    try {
      await request(url(remove.id), "DELETE");
      await load();
      setRemove(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function updateField(index: number, patch: Partial<Field>) {
    if (edit)
      setEdit({
        ...edit,
        fields: edit.fields.map((f, i) =>
          i === index ? { ...f, ...patch } : f,
        ),
      });
  }
  return (
    <section className="panel">
      <div className="report-list-heading">
        <div>
          <h1>Timbrados</h1>
          <span>
            {rows.length} {rows.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setEdit(empty());
          }}
        >
          <Plus size={15} /> Adicionar
        </button>
      </div>
      {error && !edit && !remove && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <div className="report-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Estado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  {r.active ? "Ativo" : "Inativo"}
                </td>
                <td>
                  <button
                    className="button"
                    title={`Editar ${r.name}`}
                    aria-label={`Editar ${r.name}`}
                    onClick={() => {
                      setError("");
                      setEdit(r);
                    }}
                  >
                    <Edit3 size={15} />
                  </button>{" "}
                  <button
                    className="button"
                    title={`Remover ${r.name}`}
                    aria-label={`Remover ${r.name}`}
                    onClick={() => {
                      setError("");
                      setRemove(r);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>Nenhum timbrado cadastrado.</p>}
      </div>
      {remove && (
        <InlineDialog
          title="Remover timbrado"
          subtitle=""
          busy={busy}
          onClose={() => setRemove(null)}
          footer={
            <>
              <button className="button" onClick={() => setRemove(null)}>
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void destroy()}
              >
                Remover
              </button>
            </>
          }
        >
          <p>Remover {remove.name}?</p>
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
        </InlineDialog>
      )}
      {edit && (
        <InlineDialog
          title={edit.id ? "Editar timbrado" : "Adicionar timbrado"}
          subtitle=""
          busy={busy}
          onClose={() => setEdit(null)}
          footer={
            <>
              <button className="button" onClick={() => setEdit(null)}>
                Cancelar
              </button>
              <button
                className="button primary"
                type="submit"
                form="letterhead-editor"
                disabled={busy}
              >
                Salvar
              </button>
            </>
          }
        >
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          <form id="letterhead-editor" className="op-form" onSubmit={save}>
            <label className="op-field">
              Nome
              <input
                required
                maxLength={150}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </label>
            <label className="op-field">
              Imagem de fundo (PNG, JPEG, SVG ou PDF)
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () =>
                    setEdit((v) =>
                      v
                        ? {
                            ...v,
                            background: String(reader.result).split(",")[1],
                          }
                        : v,
                    );
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <label>Fundo em paisagem (opcional)
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setEdit(v => v ? {...v, background_landscape: String(reader.result).split(",")[1]} : v);
                reader.readAsDataURL(file);
              }} />
              {edit.background_landscape && <button type="button" onClick={() => setEdit({...edit, background_landscape: ""})}>Remover fundo em paisagem</button>}
            </label>
            <p>Sem fundo em paisagem, páginas em paisagem serão geradas sem fundo.</p>
            <label>
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    active: e.target.checked,
                  })
                }
              />{" "}
              Ativo
            </label>
            <fieldset>
              <legend>Margens (mm)</legend>
              <div className="report-form-grid">
                {Object.entries({
                  top: "Topo",
                  bottom: "Base",
                  left: "Esquerda",
                  right: "Direita",
                }).map(([k, v]) => (
                  <label className="op-field" key={k}>
                    {v}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={edit.margins[k]}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          margins: {
                            ...edit.margins,
                            [k]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <label>Visualização <select value={landscape ? "landscape" : "portrait"} onChange={e => setLandscape(e.target.value === "landscape")}><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></label>
            <p>Arquivos SVG e PDF são exibidos após salvar e validar.</p>
            <div
              className="letterhead-preview"
              style={{
                aspectRatio: landscape ? "297 / 210" : "210 / 297",
                backgroundImage: ((landscape ? edit.background_landscape : edit.background) || "").match(/^(iVBOR|\/9j\/)/)
                  ? `url(data:image/png;base64,${landscape ? edit.background_landscape : edit.background})`
                  : undefined,
              }}
            >
              <div
                className="letterhead-workarea"
                style={{
                  top: `${(edit.margins.top / (landscape ? 210 : 297)) * 100}%`,
                  bottom: `${(edit.margins.bottom / (landscape ? 210 : 297)) * 100}%`,
                  left: `${(edit.margins.left / (landscape ? 297 : 210)) * 100}%`,
                  right: `${(edit.margins.right / (landscape ? 297 : 210)) * 100}%`,
                }}
              />
              {edit.fields.map((f, i) => (
                <span
                  key={i}
                  style={{
                    left: `${(f.x / 210) * 100}%`,
                    top: `${(f.y / 297) * 100}%`,
                    fontSize: `${Math.max(7, f.font_size * 0.45)}px`,
                    transform:
                      f.align === "center"
                        ? "translateX(-50%)"
                        : f.align === "right"
                          ? "translateX(-100%)"
                          : undefined,
                  }}
                >
                  {f.type === "text" ? f.text : labels[f.type]}
                </span>
              ))}
            </div>
            <fieldset>
              <legend>Campos</legend>
              {edit.fields.map((f, i) => (
                <div key={i} className="report-form-grid">
                  <label className="op-field">
                    Tipo
                    <select
                      value={f.type}
                      onChange={(e) => updateField(i, { type: e.target.value })}
                    >
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {f.type === "text" && (
                    <label className="op-field">
                      Texto
                      <input
                        maxLength={500}
                        value={f.text}
                        onChange={(e) =>
                          updateField(i, { text: e.target.value })
                        }
                      />
                    </label>
                  )}
                  {(
                    [
                      ["x", "X (mm)", 210],
                      ["y", "Y (mm)", 297],
                      ["font_size", "Tamanho", 72],
                    ] as const
                  ).map(([k, label, max]) => (
                    <label className="op-field" key={k}>
                      {label}
                      <input
                        type="number"
                        min={k === "font_size" ? 4 : 0}
                        max={max}
                        value={f[k]}
                        onChange={(e) =>
                          updateField(i, { [k]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <label className="op-field">
                    Fonte
                    <select
                      value={f.font || "Helvetica"}
                      onChange={(e) => updateField(i, { font: e.target.value })}
                    >
                      <option value="Helvetica">Helvetica</option>
                      <option value="Helvetica-Bold">Helvetica negrito</option>
                      <option value="Times-Roman">Times</option>
                      <option value="Courier">Courier</option>
                    </select>
                  </label>
                  <label className="op-field">
                    Alinhamento
                    <select
                      value={f.align}
                      onChange={(e) =>
                        updateField(i, { align: e.target.value })
                      }
                    >
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      setEdit({
                        ...edit,
                        fields: edit.fields.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Remover campo
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button"
                disabled={edit.fields.length >= 30}
                onClick={() =>
                  setEdit({
                    ...edit,
                    fields: [
                      ...edit.fields,
                      {
                        type: "title",
                        text: "",
                        x: 15,
                        y: 15,
                        font_size: 10,
                        align: "left",
                      },
                    ],
                  })
                }
              >
                Adicionar campo
              </button>
            </fieldset>
          </form>
        </InlineDialog>
      )}
    </section>
  );
}
