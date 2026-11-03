import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { query, request } from "../api";
import type { Paginated, Unit } from "../types";
import FormAction from "./FormAction";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Pause,
  Upload,
} from "lucide-react";

type UnitRow = Unit & { timezone: string; version: number };

function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 512;
        const side = Math.min(img.width, img.height);
        const sx = Math.round((img.width - side) / 2);
        const sy = Math.round((img.height - side) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result || ""));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/webp", 0.92));
      };
      img.onerror = () => resolve(String(reader.result || ""));
      img.src = String(reader.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function UnitLogoUploader({
  initialLogo = "",
  unitName = "",
}: {
  initialLogo?: string;
  unitName?: string;
}) {
  const [logo, setLogo] = useState(initialLogo);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Selecione um arquivo de imagem válido (PNG, JPG, SVG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("A imagem excede o limite máximo de 5 MB.");
      return;
    }
    setUploadError("");
    try {
      const dataUrl = await processImage(file);
      setLogo(dataUrl);
    } catch {
      setUploadError("Não foi possível carregar a imagem.");
    }
  };

  const clearLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogo("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="unit-logo-compact-wrapper">
      <input type="hidden" name="logo" value={logo} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <div
        className={`unit-logo-avatar-box ${dragOver ? "drag-over" : ""} ${logo ? "has-image" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.[0]) void handleFile(e.dataTransfer.files[0]);
        }}
        title="Clique para alterar a logo"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        {logo ? (
          <img
            src={logo}
            alt={unitName ? `Logo de ${unitName}` : "Logo"}
            className="unit-logo-avatar-img"
          />
        ) : (
          <div className="unit-logo-placeholder">
            <Building2 size={24} />
            <span>Logo</span>
          </div>
        )}
        <div className="unit-logo-avatar-hover">
          <Upload size={14} />
        </div>
      </div>
      <div className="unit-logo-compact-actions">
        <button
          type="button"
          className="unit-logo-link-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          {logo ? "Alterar" : "Adicionar"}
        </button>
        {logo && (
          <>
            <span className="unit-logo-action-sep">·</span>
            <button
              type="button"
              className="unit-logo-link-btn danger"
              onClick={clearLogo}
            >
              Remover
            </button>
          </>
        )}
      </div>
      {uploadError && <p className="inline-error">{uploadError}</p>}
    </div>
  );
}

export default function UnitDirectory({
  unit,
  editable = true,
  onChanged,
}: {
  unit: string;
  editable?: boolean;
  onChanged?: () => Promise<void>;
}) {
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    async function load() {
      const found: UnitRow[] = [];
      let page = 1;
      while (true) {
        const result = await request<Paginated<UnitRow>>(
          query("units", { unit, page: String(page) }),
        );
        found.push(...result.results);
        if (!result.next) break;
        page++;
      }
      if (active) setRows(found);
    }
    load()
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [unit, revision]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await request(query("units", { unit }), "POST", values);
      setRevision((v) => v + 1);
      window.dispatchEvent(new Event("session-refresh"));
      if (onChanged) await onChanged();
      else window.location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function configure(event: FormEvent<HTMLFormElement>, row: UnitRow) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await request(query(`units/${row.id}/configure`, { unit: row.slug }), "POST", {
        version: row.version,
        name: values.get("name"),
        timezone: values.get("timezone"),
        response_hours: Number(values.get("response_hours")),
        paused: values.get("paused") === "on",
        checkin_enabled: values.get("checkin_enabled") === "on",
        autoagenda_enabled: values.get("autoagenda_enabled") === "on",
        surveys_enabled: values.get("surveys_enabled") === "on",
        authorized_recipients: String(values.get("authorized_recipients") || "")
          .split(/[\s,;]+/)
          .filter(Boolean),
        logo: String(values.get("logo") || ""),
      });
      setRevision((v) => v + 1);
      window.dispatchEvent(new Event("session-refresh"));
      await onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="unit-directory">
      <div className="unit-toolbar">
        <div className="unit-summary">
          <span className="unit-count">
            {loading
              ? "Carregando…"
              : `${rows.length} ${rows.length === 1 ? "unidade cadastrada" : "unidades cadastradas"}`}
          </span>
        </div>
        {editable && (
          <div className="unit-toolbar-actions">
            <FormAction
              title="Nova unidade"
              label="Adicionar unidade"
              version={revision}
              busy={busy}
              error={error}
              className="unit-modal-dialog"
            >
              <form className="op-form unit-form" onSubmit={create}>
                <div className="unit-modal-identity-row">
                  <UnitLogoUploader unitName="Nova Unidade" />
                  <div className="unit-modal-identity-fields">
                    <label className="op-field unit-field-full">
                      <span>Nome da unidade</span>
                      <input
                        name="name"
                        required
                        maxLength={150}
                        autoComplete="off"
                        placeholder="Ex.: Unidade Central"
                      />
                    </label>
                    <div className="unit-modal-duo-fields">
                      <label className="op-field">
                        <span>Identificador (slug)</span>
                        <input
                          name="slug"
                          required
                          maxLength={50}
                          pattern="[a-z0-9-]+"
                          autoComplete="off"
                          placeholder="ex.: central"
                        />
                      </label>
                      <label className="op-field">
                        <span>Fuso horário</span>
                        <input
                          name="timezone"
                          required
                          defaultValue="America/Sao_Paulo"
                          placeholder="America/Sao_Paulo"
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <button type="submit" className="button primary">
                  Criar unidade
                </button>
              </form>
            </FormAction>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="directory-empty" role="status">
          Carregando unidades…
        </p>
      ) : (
        <div className="table-scroll">
          <table className="directory-table">
            <thead>
              <tr>
                <th className="unit-col-name">Unidade</th>
                <th className="unit-col-slug">Identificador</th>
                <th className="unit-col-timezone">Fuso horário</th>
                <th className="unit-col-status">Envios</th>
                <th className="unit-col-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug}>
                  <td className="unit-col-name">
                    <div className="unit-name-cell">
                      {row.logo ? (
                        <span className="unit-table-logo-badge" title={`Logo de ${row.name}`}>
                          <img src={row.logo} alt="" className="unit-logo-img" />
                        </span>
                      ) : (
                        <span className="unit-table-icon-fallback" aria-hidden="true">
                          <Building2 size={16} />
                        </span>
                      )}
                      <div className="unit-name-info">
                        <strong>{row.name}</strong>
                        {row.slug === unit && (
                          <span className="directory-current">Atual</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="unit-col-slug">
                    <span className="directory-code">{row.slug}</span>
                  </td>
                  <td className="unit-col-timezone">{row.timezone}</td>
                  <td className="unit-col-status">
                    <span
                      className={`directory-status ${row.paused ? "paused" : "active"}`}
                    >
                      {row.paused ? "Pausados" : "Ativos"}
                    </span>
                  </td>
                  <td className="unit-col-actions">
                    {editable && (
                      <FormAction
                        key={`${row.id}:${row.version}`}
                        title={`Configurar ${row.name}`}
                        label="Editar"
                        version={revision}
                        busy={busy}
                        error={error}
                        className="unit-modal-dialog"
                      >
                        <form
                          className="op-form unit-form"
                          onSubmit={(e) => void configure(e, row)}
                        >
                          <div className="unit-modal-identity-row">
                            <UnitLogoUploader initialLogo={row.logo || ""} unitName={row.name} />
                            <div className="unit-modal-identity-fields">
                              <label className="op-field unit-field-full">
                                <span>Nome da unidade</span>
                                <input
                                  name="name"
                                  required
                                  maxLength={150}
                                  defaultValue={row.name}
                                  placeholder="Nome da unidade"
                                />
                              </label>
                              <div className="unit-modal-duo-fields">
                                <label className="op-field">
                                  <span>Fuso horário</span>
                                  <input
                                    name="timezone"
                                    required
                                    defaultValue={row.timezone}
                                    placeholder="America/Sao_Paulo"
                                  />
                                </label>
                                <label className="op-field">
                                  <span>Prazo de resposta (horas)</span>
                                  <input
                                    name="response_hours"
                                    type="number"
                                    required
                                    min={1}
                                    max={168}
                                    defaultValue={row.response_hours}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="unit-form-section">
                            <div className="unit-section-header">
                              <span className="unit-section-title">Módulos da Unidade</span>
                              <span className="unit-section-desc">Ative ou desative os serviços disponíveis</span>
                            </div>
                            <div className="unit-modules-grid">
                              <label className="unit-module-card">
                                <div className="unit-module-header">
                                  <div className="unit-module-header-left">
                                    <CheckCircle2 size={16} className="unit-module-icon" />
                                    <span className="unit-module-title">Check-in</span>
                                  </div>
                                  <div className="unit-toggle-switch">
                                    <input
                                      className="unit-toggle-input"
                                      role="switch"
                                      name="checkin_enabled"
                                      type="checkbox"
                                      defaultChecked={row.checkin_enabled}
                                    />
                                    <span className="unit-toggle-slider" />
                                  </div>
                                </div>
                                <p className="unit-module-desc">Confirmações e presença</p>
                              </label>

                              <label className="unit-module-card">
                                <div className="unit-module-header">
                                  <div className="unit-module-header-left">
                                    <MessageSquare size={16} className="unit-module-icon" />
                                    <span className="unit-module-title">Autoagendamento</span>
                                  </div>
                                  <div className="unit-toggle-switch">
                                    <input
                                      className="unit-toggle-input"
                                      role="switch"
                                      name="autoagenda_enabled"
                                      type="checkbox"
                                      defaultChecked={row.autoagenda_enabled}
                                    />
                                    <span className="unit-toggle-slider" />
                                  </div>
                                </div>
                                <p className="unit-module-desc">Atendimento via chat</p>
                              </label>

                              <label className="unit-module-card">
                                <div className="unit-module-header">
                                  <div className="unit-module-header-left">
                                    <ClipboardList size={16} className="unit-module-icon" />
                                    <span className="unit-module-title">Pesquisas</span>
                                  </div>
                                  <div className="unit-toggle-switch">
                                    <input
                                      className="unit-toggle-input"
                                      role="switch"
                                      name="surveys_enabled"
                                      type="checkbox"
                                      defaultChecked={row.surveys_enabled}
                                    />
                                    <span className="unit-toggle-slider" />
                                  </div>
                                </div>
                                <p className="unit-module-desc">Satisfação pós-atendimento</p>
                              </label>
                            </div>
                          </div>

                          <div className="unit-form-section">
                            <div className="unit-section-header">
                              <span className="unit-section-title">Operação e Envios</span>
                            </div>

                            <label className="unit-pause-banner">
                              <div className="unit-pause-info">
                                <div className="unit-pause-title-row">
                                  <Pause size={16} className="unit-pause-icon" />
                                  <span className="unit-pause-title">Pausar envios da unidade</span>
                                </div>
                                <span className="unit-pause-desc">
                                  Suspende temporariamente as mensagens automáticas
                                </span>
                              </div>
                              <div className="unit-toggle-switch">
                                <input
                                  className="unit-toggle-input"
                                  role="switch"
                                  name="paused"
                                  type="checkbox"
                                  defaultChecked={row.paused}
                                />
                                <span className="unit-toggle-slider" />
                              </div>
                            </label>

                            <label className="op-field unit-test-recipients-field">
                              <span>Destinatários autorizados para teste</span>
                              <textarea
                                name="authorized_recipients"
                                defaultValue={
                                  row.effective_recipients?.join("\n") || ""
                                }
                                rows={2}
                                placeholder="5517992714448 (separados por vírgula ou uma linha por número)"
                              />
                            </label>
                          </div>

                          <button
                            type="submit"
                            className="button primary"
                            disabled={busy}
                          >
                            Salvar unidade
                          </button>
                        </form>
                      </FormAction>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="directory-empty">Nenhuma unidade cadastrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
