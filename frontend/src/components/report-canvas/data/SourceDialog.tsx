import { friendlyParameterName, friendlyParameterValue, collectTestParameters } from "../parameters";
import { previewParameters } from "../hooks/useStagePreviews";
import { query, request } from "../../../api";
import { friendlySourceError, friendlySourceName } from "./sourceName";
import { displayFixedDate, isDateParameter, maskFixedDate, parseFixedDate } from "./fixedDate";
import { formatRowCount } from "./rowCount";
import { formatCellValue } from "./columnTypes";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, FormEvent } from "react";
import {
  AlertCircle,
  Check,
  Database,
  Plus,
  RefreshCw,
  Table,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import InlineDialog from "../../InlineDialog";
import Select from "../../Select";
import { fetchSourcePreviewRequest } from "../api/useSourcePreview";
import type {
  CanvasSource,
  CatalogSqlSource,
  SourceDialogState,
} from "../model";
import { isParameterBinding } from "../model";
import ColumnBadge from "./ColumnBadge";
import { inferColumnType } from "./columnTypes";
import {
  parsePastedTable,
  slugifySourceName,
  validateSourceId,
} from "./sourceOps";

export interface SourceDialogProps {
  sourceModal: SourceDialogState | null;
  availableSources: CatalogSqlSource[];
  reportId?: number;
  unit?: string;
  currentReportParameters?: Record<string, any>;
  monthlyGoals?: Array<{ year: number; month: number; value: number }>;
  existingSources?: CanvasSource[];
  onChange: (next: SourceDialogState) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

interface ParsedParamItem {
  key: string;
  isBinding: boolean;
  bindingKey: string;
  fixedValue: string;
  type: string;
}

export default function SourceDialog({
  sourceModal,
  availableSources,
  reportId = 1,
  unit = "",
  currentReportParameters = {},
  monthlyGoals = [],
  existingSources = [],
  onChange,
  onClose,
  onSubmit,
}: SourceDialogProps) {
  const sourceFormId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [schema, setSchema] = useState<Record<string, unknown>>({});
  const [schemaStatus, setSchemaStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    if (!sourceModal || sourceModal.type !== "report" || !sourceModal.reportId) return;
    const controller = new AbortController();
    setSchemaStatus("loading");
    request<{parameter_schema?: Record<string, unknown>}>(query(`reports/${sourceModal.reportId}`, {unit}), "GET", undefined, controller.signal)
      .then(data => { setSchema(data.parameter_schema || {}); setSchemaStatus("ready"); })
      .catch(() => { if (!controller.signal.aborted) { setSchema({}); setSchemaStatus("error"); } });
    return () => controller.abort();
  }, [sourceModal?.reportId, sourceModal?.type, unit]);
  const testAbort = useRef<AbortController | null>(null);
  const latestPreviewSpec = useRef("");
  latestPreviewSpec.current = JSON.stringify([sourceModal?.parametersJson, sourceModal?.reportId, sourceModal?.dataset]);
  const [testing, setTesting] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);
  const [showAdvancedId, setShowAdvancedId] = useState(false);

  // Manual table state parsed from JSON
  const [gridColumns, setGridColumns] = useState<string[]>([]);
  const [gridRows, setGridRows] = useState<Array<Array<string | number | boolean | null>>>([]);

  // Initialize or sync grid state
  useEffect(() => {
    if (!sourceModal || sourceModal.type !== "inline") return;
    try {
      const cols = JSON.parse(sourceModal.columnsJson || "[]");
      const rows = JSON.parse(sourceModal.rowsJson || "[]");
      if (Array.isArray(cols)) setGridColumns(cols);
      if (Array.isArray(rows)) setGridRows(rows);
    } catch {
      // Fallback
    }
  }, [sourceModal?.columnsJson, sourceModal?.rowsJson, sourceModal?.type]);

  const idError = useMemo(() => {
    if (!sourceModal) return null;
    const res = validateSourceId(sourceModal.id, existingSources, sourceModal.originalId);
    return res.ok ? null : res.error;
  }, [existingSources, sourceModal?.id, sourceModal?.originalId]);

  const filteredCatalog = useMemo(() => [...availableSources].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [availableSources]);

  const currentParamsMap = useMemo(() => {
    try {
      const parsed = JSON.parse(sourceModal?.parametersJson || "{}");
      return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }, [sourceModal?.parametersJson]);

  // Combined parameters: from catalog schema + existing custom parameters
  const paramItems = useMemo<ParsedParamItem[]>(() => {
    const items: ParsedParamItem[] = [];
    const seen = new Set<string>();

    // From current parameter JSON
    for (const [k, v] of Object.entries(currentParamsMap)) {
      seen.add(k);
      if (isParameterBinding(v)) {
        items.push({
          key: k,
          isBinding: true,
          bindingKey: v.parameter,
          fixedValue: "",
          type: "string",
        });
      } else {
        items.push({
          key: k,
          isBinding: false,
          bindingKey: "",
          fixedValue: v === null || v === undefined ? "" : String(v),
          type: typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string",
        });
      }
    }

    return items;
  }, [currentParamsMap]);

  const inferredGridTypes = useMemo(() => {
    return gridColumns.map((_, colIdx) => {
      const colValues = gridRows.map((r) => r[colIdx]);
      return inferColumnType(colValues);
    });
  }, [gridColumns, gridRows]);

  if (!sourceModal) return null;

  const isCreate = sourceModal.mode === "create";

  const selectedCatalog = availableSources.find(
    (s) => s.id === Number(sourceModal.reportId),
  );


  // Handle label change and auto slug
  const handleLabelChange = (val: string) => {
    const trimmed = val.slice(0, 60);
    const updates: Partial<SourceDialogState> = { label: trimmed };
    if (autoSlug && isCreate) {
      const generated = slugifySourceName(trimmed);
      if (generated) updates.id = generated;
    }
    onChange({ ...sourceModal, ...updates });
  };

  const handleIdChange = (val: string) => {
    setAutoSlug(false);
    onChange({ ...sourceModal, id: val });
  };

  // Switch source type
  const handleTypeChange = (nextType: "report" | "inline" | "goals") => {
    let nextId = sourceModal.id;
    if (isCreate) {
      if (nextType === "goals") nextId = "metas";
      else if (nextType === "inline" && (!sourceModal.label || autoSlug)) nextId = "tabela_manual";
    }
    onChange({
      ...sourceModal,
      type: nextType,
      id: nextId,
      testPreview: null,
      testError: null,
      error: "",
    });
  };

  // Parameters list management for "report" source

  const updateParameterJson = (items: ParsedParamItem[]) => {
    const obj: Record<string, any> = {};
    for (const item of items) {
      if (!item.key.trim()) continue;
      const k = item.key.trim();
      if (item.isBinding) {
        obj[k] = { parameter: item.bindingKey.trim() || k };
      } else {
        if (item.type === "number") {
          const num = Number(item.fixedValue);
          obj[k] = Number.isFinite(num) ? num : item.fixedValue;
        } else if (item.type === "boolean") {
          obj[k] = item.fixedValue === "true";
        } else {
          obj[k] = item.fixedValue;
        }
      }
    }
    onChange({ ...sourceModal, parametersJson: JSON.stringify(obj, null, 2), testPreview: null, testError: "Parâmetros alterados. Teste a fonte novamente." });
  };

  const handleAddParam = () => {
    const newKey = `param_${paramItems.length + 1}`;
    const next = [
      ...paramItems,
      {
        key: newKey,
        isBinding: Object.keys(currentReportParameters).length > 0,
        bindingKey: Object.keys(currentReportParameters)[0] || "",
        fixedValue: "",
        type: "string",
      },
    ];
    updateParameterJson(next);
  };

  const handleRemoveParam = (index: number) => {
    const item = paramItems[index];
    if (!item || !window.confirm(`Remover o vínculo do parâmetro "${item.key}" desta fonte? A consulta pode passar a usar o valor padrão ou falhar. A alteração só será gravada ao salvar o relatório.`)) return;
    const next = { ...currentParamsMap };
    delete next[item.key];
    onChange({ ...sourceModal, parametersJson: JSON.stringify(next, null, 2), testPreview: null, testError: "Parâmetros alterados. Teste a fonte novamente." });
  };

  const handleParamChange = (index: number, patch: Partial<ParsedParamItem>) => {
    const next = paramItems.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    updateParameterJson(next);
  };

  // Manual table grid operations
  const updateGridState = (
    newCols: string[],
    newRows: Array<Array<string | number | boolean | null>>,
  ) => {
    setGridColumns(newCols);
    setGridRows(newRows);
    onChange({
      ...sourceModal,
      columnsJson: JSON.stringify(newCols),
      rowsJson: JSON.stringify(newRows, null, 2),
    });
  };

  const handleAddColumn = () => {
    if (gridColumns.length >= 100) return;
    const name = `coluna_${gridColumns.length + 1}`;
    const newCols = [...gridColumns, name];
    const newRows = gridRows.map((r) => [...r, ""]);
    updateGridState(newCols, newRows);
  };

  const handleRemoveColumn = (colIdx: number) => {
    if (gridColumns.length <= 1) return;
    const newCols = gridColumns.filter((_, idx) => idx !== colIdx);
    const newRows = gridRows.map((r) => r.filter((_, idx) => idx !== colIdx));
    updateGridState(newCols, newRows);
  };

  const handleRenameColumn = (colIdx: number, newName: string) => {
    const newCols = [...gridColumns];
    newCols[colIdx] = newName.slice(0, 100);
    updateGridState(newCols, gridRows);
  };

  const handleAddRow = () => {
    if (gridRows.length >= 2000) return;
    const emptyRow = gridColumns.map(() => "");
    const newRows = [...gridRows, emptyRow];
    updateGridState(gridColumns, newRows);
  };

  const handleRemoveRow = (rowIdx: number) => {
    const newRows = gridRows.filter((_, idx) => idx !== rowIdx);
    updateGridState(gridColumns, newRows);
  };

  const handleCellChange = (rowIdx: number, colIdx: number, val: string) => {
    const newRows = gridRows.map((r, rIdx) => {
      if (rIdx !== rowIdx) return r;
      const nextR = [...r];
      nextR[colIdx] = val;
      return nextR;
    });
    updateGridState(gridColumns, newRows);
  };

  // Handle Ctrl+V paste on grid
  const handlePasteOnGrid = (e: ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t;,\r\n]/.test(text)) return;
    e.preventDefault();
    try {
      const parsed = parsePastedTable(text);
      if (parsed.columns.length > 0) updateGridState(parsed.columns, parsed.rows);
    } catch (error) {
      onChange({ ...sourceModal, error: (error as Error).message });
    }
  };

  // Handle CSV file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || "");
      if (text) {
        try {
          const parsed = parsePastedTable(text);
          if (parsed.columns.length > 0) updateGridState(parsed.columns, parsed.rows);
        } catch (error) {
          onChange({ ...sourceModal, error: (error as Error).message });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Draft source construction for testing preview & saving
  const constructDraftSource = (): CanvasSource => {
    const label = sourceModal.label?.trim() || undefined;
    if (sourceModal.type === "report") {
      let params = {};
      try {
        params = JSON.parse(sourceModal.parametersJson || "{}");
      } catch {
        // Fallback
      }
      return {
        id: sourceModal.id.trim(),
        type: "report",
        report_id: Number(sourceModal.reportId) || 1,
        label,
        dataset: sourceModal.dataset || selectedCatalog?.datasets?.[0]?.id,
        parameters: params,
      };
    }
    if (sourceModal.type === "inline") {
      return {
        id: sourceModal.id.trim(),
        type: "inline",
        label,
        columns: gridColumns,
        rows: gridRows,
      };
    }
    return {
      id: sourceModal.id.trim(),
      type: "goals",
      label,
    };
  };

  // Test and load preview
  const handleTestPreview = async () => {
    testAbort.current?.abort();
    const controller = new AbortController();
    testAbort.current = controller;
    performance.mark("canvas-teste-fonte-inicio");
    setTesting(true);
    const testedSpec = latestPreviewSpec.current;
    onChange({ ...sourceModal, testError: null, testPreview: null });
    try {
      let draft = constructDraftSource();
      if (draft.type === "report") {
        const {fields, values} = previewParameters(draft, schema, currentReportParameters, unit, new Date(), isCreate);
        draft = {...draft, parameters: {...draft.parameters, ...collectTestParameters(fields, values)} as Extract<CanvasSource, {type: "report"}>["parameters"]};
      }
      const preview = await fetchSourcePreviewRequest(
        reportId,
        unit,
        draft,
        {},
        10,
        controller.signal,
      );
      if (testedSpec === latestPreviewSpec.current) onChange({ ...sourceModal, testPreview: preview, testError: null });
    } catch (err: any) {
      if (controller.signal.aborted) return;
      const msg = friendlySourceError(err?.message || "Falha ao carregar prévia.", constructDraftSource(), selectedCatalog);
      if (testedSpec === latestPreviewSpec.current) onChange({ ...sourceModal, testError: msg, testPreview: null });
    } finally {
      if (testAbort.current === controller) {
        performance.mark("canvas-teste-fonte-fim");
        performance.measure("canvas-teste-fonte", "canvas-teste-fonte-inicio", "canvas-teste-fonte-fim");
        setTesting(false);
      }
    }
  };

  const invalidDate = paramItems.some(param => !param.isBinding && isDateParameter(param.key, param.type) && param.fixedValue !== "" && !parseFixedDate(displayFixedDate(param.fixedValue)));
  const draftSource = constructDraftSource();

  return (
    <InlineDialog
      title={isCreate ? "Adicionar fonte de dados" : "Editar fonte de dados"}
      subtitle="Escolha a origem e configure a fonte."
      className="cv-subdialog cv-root"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cv-btn-compact" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="cv-btn-compact"
            onClick={handleTestPreview}
            disabled={testing || Boolean(idError) || invalidDate || (sourceModal.type === "report" && (!sourceModal.reportId || schemaStatus !== "ready"))}
            title="Executar consulta e verificar dados retornados"
          >
            <RefreshCw size={12} className={testing ? "spin" : ""} />
            {testing ? "Testando…" : "Testar e carregar prévia"}
          </button>
          <button
            type="submit"
            form={sourceFormId}
            className="cv-btn-compact primary"
            disabled={Boolean(idError) || invalidDate || !sourceModal.label?.trim() || (sourceModal.type === "goals" && !monthlyGoals.length)}
            title={!sourceModal.label?.trim() ? "Informe o nome da fonte." : sourceModal.type === "goals" && !monthlyGoals.length ? "Cadastre metas mensais antes de adicionar esta fonte." : undefined}
          >
            {isCreate ? "Adicionar" : "Salvar"}
          </button>
        </>
      }
    >
      <form id={sourceFormId} className="cv-subform" onSubmit={event => {
        if (invalidDate || !sourceModal.label?.trim() || (sourceModal.type === "goals" && !monthlyGoals.length) || (sourceModal.type === "report" && (!selectedCatalog || schemaStatus !== "ready"))) {
          event.preventDefault();
          onChange({...sourceModal, error: !selectedCatalog && sourceModal.type === "report" ? "Escolha um relatório." : "Confira os campos obrigatórios antes de adicionar."});
          event.currentTarget.querySelector<HTMLElement>(!selectedCatalog && sourceModal.type === "report" ? '[role=combobox]' : 'input[required]')?.focus();
          return;
        }
        if (sourceModal.type === "report") {
          try { const {fields, values} = previewParameters(draftSource, schema, currentReportParameters, unit, new Date(), isCreate); collectTestParameters(fields, values); }
          catch (error) { event.preventDefault(); onChange({...sourceModal, error: (error as Error).message}); event.currentTarget.querySelector<HTMLElement>('.cv-params-section input, .cv-params-section select')?.focus(); return; }
        }
        onSubmit(event);
      }}>
        {sourceModal.error && (
          <p className="inline-error" role="alert">
            <AlertCircle size={14} />
            {friendlySourceError(sourceModal.error, constructDraftSource(), selectedCatalog)}
          </p>
        )}

        {/* 2. Tipo de Fonte (Segmented control) */}
        <div className="op-field">
          <span>1. De onde vêm os dados?</span>
          <div className="cv-segmented cv-source-tabs" role="tablist" aria-label="Origem dos dados" onKeyDown={e => {
            const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
            const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
            const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
            if (next >= 0) { e.preventDefault(); tabs[next].focus(); }
          }}>
            <button
              type="button"
              role="tab"
              aria-selected={sourceModal.type === "report"}
              tabIndex={sourceModal.type === "report" ? 0 : -1}
              className={`cv-segmented-btn ${sourceModal.type === "report" ? "active" : ""}`}
              onClick={() => handleTypeChange("report")}
            >
              <Database size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Relatório existente
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sourceModal.type === "inline"}
              tabIndex={sourceModal.type === "inline" ? 0 : -1}
              className={`cv-segmented-btn ${sourceModal.type === "inline" ? "active" : ""}`}
              onClick={() => handleTypeChange("inline")}
            >
              <Table size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Tabela manual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sourceModal.type === "goals"}
              tabIndex={sourceModal.type === "goals" ? 0 : -1}
              className={`cv-segmented-btn ${sourceModal.type === "goals" ? "active" : ""}`}
              onClick={() => handleTypeChange("goals")}
            >
              <Target size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Metas mensais
            </button>
          </div>
        </div>

        {sourceModal.type === "report" && selectedCatalog && (
          <p className="cv-source-sub" title={selectedCatalog.name}>
            Origem: {selectedCatalog?.name || `Relatório #${sourceModal.reportId}`}. Colunas: {(
              selectedCatalog?.datasets?.find(d => d.id === (sourceModal.dataset || selectedCatalog.datasets?.[0]?.id))?.columns
              || selectedCatalog?.columns || []
            ).join(", ") || "Use Testar e carregar prévia para consultar as colunas."}
          </p>
        )}

        {sourceModal.type === "report" && selectedCatalog?.available === false && <p className="cv-source-sub" role="status">{selectedCatalog.unavailable_reason}</p>}
        <h3>2. Escolha os dados</h3>
        {/* Conteúdo para Relatório Existente */}
        {sourceModal.type === "report" && (
          <>
            <div className="cv-grid-2">
              <label className="op-field">
                <span>Relatório cadastrado na unidade</span>
                <Select required value={sourceModal.reportId} onChange={e => {
                  const chosen = availableSources.find(item => item.id === Number(e.target.value));
                  onChange({...sourceModal, reportId: e.target.value, dataset: undefined,
                    label: chosen && isCreate ? chosen.name.slice(0, 60) : sourceModal.label,
                    parametersJson: "{}", testPreview: null, testError: null});
                }}>
                  <option value="">Escolha um relatório</option>
                  {filteredCatalog.map(s => <option key={s.id} value={s.id}>{s.name}{s.available === false ? " · Pendente" : ""}</option>)}
                </Select>
              </label>

              {!!selectedCatalog?.datasets?.length && (
                <label className="op-field">
                  <span>Conjunto de dados</span>
                  <Select
                    value={sourceModal.dataset || selectedCatalog.datasets[0]?.id || ""}
                    onChange={(e) =>
                      onChange({ ...sourceModal, dataset: e.target.value, testPreview: null })
                    }
                  >
                    {selectedCatalog.datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.columns?.length || 0} colunas)
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>

            {sourceModal.reportId && schemaStatus === "loading" && <p role="status">Carregando opções do relatório…</p>}
            {sourceModal.reportId && schemaStatus === "error" && <p role="alert">Não foi possível carregar as opções do relatório. Feche a janela e tente novamente.</p>}
            {sourceModal.reportId && schemaStatus === "ready" && (() => {
              const {fields, values} = previewParameters(constructDraftSource(), schema, currentReportParameters, unit, new Date(), isCreate);
              return fields.length ? <div className="cv-params-section"><strong>Valores para a prévia</strong>
                {fields.map(field => <label className="op-field" key={field.name}>
                  <span>{field.label}{field.required !== false ? " * (obrigatório)" : " (opcional)"}</span>
                  {field.required !== false && <small>Se ficar vazio, a consulta não poderá ser executada.</small>}
                  {field.options ? <Select value={values[field.name] || ""} onChange={e => onChange({...sourceModal, parametersJson: JSON.stringify({...currentParamsMap, [field.name]: e.target.value}, null, 2), testPreview: null, testError: null})}>
                    <option value="">Selecione</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select> : <input value={values[field.name] || ""} placeholder={field.type === "date" ? "DD/MM/AAAA" : "Informe um valor"} onChange={e => onChange({...sourceModal, parametersJson: JSON.stringify({...currentParamsMap, [field.name]: field.type === "date" ? (parseFixedDate(e.target.value) || e.target.value) : e.target.value}, null, 2), testPreview: null, testError: null})} />}
                </label>)}
              </div> : <p className="cv-hint">Este relatório não exige valores adicionais.</p>;
            })()}
            {/* Seção de Parâmetros */}
            <details className="cv-params-section"><summary>Outras opções de parâmetros</summary>
              <div className="cv-params-head">
                <span className="cv-params-title">Parâmetros da consulta</span>
                <button
                  type="button"
                  className="cv-btn-compact"
                  onClick={handleAddParam}
                  title="Adicionar parâmetro de consulta"
                >
                  <Plus size={12} />
                  Adicionar parâmetro
                </button>
              </div>

              {paramItems.length === 0 ? (
                <p className="cv-hint" style={{ margin: "4px 0" }}>
                  Nenhum parâmetro configurado. A fonte usará os valores padrão da consulta.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {paramItems.map((param, idx) => (
                    <div key={idx} className="cv-param-card">
                      <div className="cv-param-row">
                        <details><summary>{friendlyParameterName(param.key) || "Novo parâmetro"}</summary><label>Identificador técnico (avançado)
                        <input
                          type="text"
                          placeholder="Identificador técnico"
                          value={param.key}
                          onChange={(e) => handleParamChange(idx, { key: e.target.value })}
                          className="cv-font-mono"
                          style={{ height: "28px", fontSize: "12px" }}
                        /></label></details>

                        {param.isBinding ? (
                          <Select
                            value={param.bindingKey}
                            onChange={(e) => handleParamChange(idx, { bindingKey: e.target.value })}
                            aria-label="Parâmetro do relatório atual"
                          >
                            <option value="">Selecione parâmetro atual</option>
                            {Object.keys(currentReportParameters).map((pKey) => (
                              <option key={pKey} value={pKey}>
                                Parâmetro do relatório: {friendlyParameterName(pKey)}
                              </option>
                            ))}
                          </Select>
                        ) : isDateParameter(param.key, param.type) ? (
                          <div>
                            <input type="text" inputMode="numeric" aria-label={`Valor de ${friendlyParameterName(param.key)}`}
                              aria-invalid={param.fixedValue !== "" && !parseFixedDate(displayFixedDate(param.fixedValue))}
                              placeholder="DD/MM/AAAA" value={displayFixedDate(param.fixedValue)}
                              onChange={(e) => { const masked = maskFixedDate(e.target.value); handleParamChange(idx, { fixedValue: parseFixedDate(masked) || masked }); }}
                              style={{ height: "28px", fontSize: "12px" }} />
                            {param.fixedValue !== "" && !parseFixedDate(displayFixedDate(param.fixedValue)) && <span className="inline-error" role="alert">Informe uma data válida no formato DD/MM/AAAA.</span>}
                          </div>
                        ) : (
                          <input type="text" aria-label={`Valor de ${friendlyParameterName(param.key)}`} title="Valor fixo" placeholder="Valor fixo"
                            value={friendlyParameterValue(param.key, param.fixedValue) === "—" ? "" : friendlyParameterValue(param.key, param.fixedValue)} onChange={(e) => handleParamChange(idx, { fixedValue: /^(unidade|unit)$/i.test(param.key) && e.target.value.toLowerCase() === "ame votuporanga" ? "ame" : param.key === "tipo_envio" && e.target.value === "Agendamento" ? "appointment" : e.target.value })}
                            style={{ height: "28px", fontSize: "12px" }} />
                        )}

                        <button
                          type="button"
                          className="cv-icon-btn danger"
                          onClick={() => handleRemoveParam(idx)}
                          title="Remover parâmetro"
                          aria-label="Remover parâmetro"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="cv-param-mode-toggle">
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="radio"
                            name={`param_mode_${idx}`}
                            checked={param.isBinding}
                            onChange={() => handleParamChange(idx, { isBinding: true })}
                          />
                          <span>Usar parâmetro do relatório atual</span>
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="radio"
                            name={`param_mode_${idx}`}
                            checked={!param.isBinding}
                            onChange={() => handleParamChange(idx, { isBinding: false })}
                          />
                          <span>Valor fixo</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </details>
          </>
        )}

        {/* 4. Conteúdo para Tabela Manual */}
        {sourceModal.type === "inline" && (
          <div className="cv-table-editor" onPaste={handlePasteOnGrid}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={handleFileUpload}
            />

            <div className="cv-table-editor-toolbar">
              <span className="cv-table-editor-stats">
                {gridColumns.length} colunas (máx 100) × {gridRows.length} linhas (máx 2000)
              </span>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="cv-btn-compact"
                  onClick={handleAddColumn}
                  title="Adicionar coluna"
                >
                  <Plus size={12} /> Coluna
                </button>
                <button
                  type="button"
                  className="cv-btn-compact"
                  onClick={handleAddRow}
                  title="Adicionar linha"
                >
                  <Plus size={12} /> Linha
                </button>
                <button
                  type="button"
                  className="cv-btn-compact"
                  onClick={() => fileInputRef.current?.click()}
                  title="Importar dados de arquivo CSV"
                >
                  <Upload size={12} /> Importar .csv
                </button>
              </div>
            </div>

            <div className="cv-table-editor-scroll">
              <table className="cv-grid-table">
                <thead>
                  <tr>
                    <th style={{ width: 32, textAlign: "center" }}>#</th>
                    {gridColumns.map((colName, cIdx) => (
                      <th key={cIdx}>
                        <div className="cv-grid-header-cell">
                          <ColumnBadge type={inferredGridTypes[cIdx]} />
                          <input
                            type="text"
                            value={colName}
                            onChange={(e) => handleRenameColumn(cIdx, e.target.value)}
                            className="cv-grid-input"
                            style={{ fontWeight: 600 }}
                            title="Nome da coluna"
                          />
                          {gridColumns.length > 1 && (
                            <button
                              type="button"
                              className="cv-icon-btn danger"
                              style={{ width: 20, height: 20 }}
                              onClick={() => handleRemoveColumn(cIdx)}
                              title="Remover coluna"
                              aria-label="Remover coluna"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {gridRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={gridColumns.length + 2}
                        style={{ textAlign: "center", padding: "16px", color: "var(--cv-text-3)" }}
                      >
                        Nenhuma linha. Clique em "+ Linha" ou cole dados do Excel (Ctrl+V).
                      </td>
                    </tr>
                  ) : (
                    gridRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ textAlign: "center", color: "var(--cv-text-disabled)" }}>
                          {rIdx + 1}
                        </td>
                        {gridColumns.map((_, cIdx) => (
                          <td key={cIdx}>
                            <input
                              type="text"
                              value={row[cIdx] === null || row[cIdx] === undefined ? "" : String(row[cIdx])}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              className="cv-grid-input"
                            />
                          </td>
                        ))}
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="cv-icon-btn danger"
                            style={{ width: 20, height: 20 }}
                            onClick={() => handleRemoveRow(rIdx)}
                            title="Remover linha"
                            aria-label="Remover linha"
                          >
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <span className="cv-hint">
              Dica: você pode copiar uma tabela do Excel ou Google Sheets e colar com Ctrl+V aqui.
            </span>
          </div>
        )}

        {/* 5. Conteúdo para Metas Mensais */}
        {sourceModal.type === "goals" && (
          <div className="cv-table-editor">
            <p className="cv-hint" style={{ margin: "4px 0" }}>
              Utiliza as metas mensais cadastradas neste relatório: ano, mês e valor.
            </p>
            {monthlyGoals.length > 0 ? (
              <div className="cv-table-editor-scroll" style={{ maxHeight: 160 }}>
                <table className="cv-grid-table">
                  <thead>
                    <tr>
                      <th>Ano (year)</th>
                      <th>Mês (month)</th>
                      <th>Valor (value)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyGoals.map((g, idx) => (
                      <tr key={idx}>
                        <td>{g.year}</td>
                        <td>{g.month}</td>
                        <td style={{ textAlign: "right" }}>{g.value.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="cv-hint" style={{ color: "var(--cv-warning)" }}>
                Nenhuma meta cadastrada. Cadastre metas nas configurações do relatório para adicionar esta fonte.
              </p>
            )}
          </div>
        )}

        <h3>3. Nome da fonte e opções</h3>
        <div className="cv-grid-2">
          <label className="op-field">
            <span>Nome da fonte</span>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="Ex.: Faturamento Mensal"
              value={sourceModal.mode === "edit" && sourceModal.label ? friendlySourceName({...constructDraftSource(), label: sourceModal.label}, selectedCatalog) : sourceModal.label || ""}
              onChange={(e) => handleLabelChange(e.target.value)}
            />
          </label>

        </div>

        {!sourceModal.label?.trim() && <p className="cv-hint">Informe o nome da fonte para adicionar.</p>}

        {/* Prévia */}
        {testing && (
          <div className="cv-test-preview" style={{ textAlign: "center", padding: "16px" }}>
            <RefreshCw size={14} className="spin" style={{ marginRight: 6 }} />
            Executando prévia dos dados...
          </div>
        )}

        {sourceModal.testError && (
          <div className="cv-test-preview" style={{ borderColor: sourceModal.testError.startsWith("Parâmetros alterados.") ? "var(--cv-line)" : "var(--cv-danger-line)" }}>
            <p className={sourceModal.testError.startsWith("Parâmetros alterados.") ? undefined : "inline-error"} style={{ margin: 0 }}>
              <AlertCircle size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
              {sourceModal.testError}
            </p>
          </div>
        )}

        {sourceModal.testPreview && (
          <div className="cv-test-preview">
            <div className="cv-test-preview-head">
              <span>
                <strong>Prévia confirmada:</strong> {sourceModal.testPreview.columns.length} colunas ·{" "}
                {formatRowCount(sourceModal.testPreview.rows.length, sourceModal.testPreview)}{" "}
                {sourceModal.testPreview.elapsed_ms != null ? `(${sourceModal.testPreview.elapsed_ms} ms)` : ""}
              </span>
              {sourceModal.testPreview.rows.length ? <span className="cv-chip ready">
                <Check size={10} /> Teste com sucesso
              </span> : <span role="status">A consulta funcionou, mas não trouxe nenhuma linha para esses filtros. Confira unidade e período.</span>}
            </div>

            {sourceModal.testPreview.effective_parameters != null && <div>
              <strong>Parâmetros aplicados:</strong>{" "}
              {sourceModal.testPreview.effective_parameters.length ? sourceModal.testPreview.effective_parameters.map(p => `${friendlyParameterName(p.name)}: ${(previewParameters(draftSource, schema, currentReportParameters, unit, new Date(), isCreate).fields.find(f => f.name === p.name)?.options?.find(o => o.value === String(p.value))?.label || friendlyParameterValue(p.name, p.value))}${p.default ? " (padrão)" : ""}`).join(" · ") : "Nenhum"}
            </div>}
            {sourceModal.type === "report" && sourceModal.testPreview.effective_parameters == null && <p>Os valores efetivos desta origem não estão disponíveis na prévia.</p>}

            <div style={{ overflowX: "auto", maxHeight: 180 }}>
              <table className="cv-preview-table">
                <thead>
                  <tr>
                    {sourceModal.testPreview.columns.map((col, idx) => (
                      <th key={idx}>
                        <div className="cv-table-th-content">
                          <ColumnBadge type={col.type} looksLike={col.looks_like} />
                          <span>{col.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sourceModal.testPreview.rows.slice(0, 10).map((row, rIdx) => (
                    <tr key={rIdx}>
                      {sourceModal.testPreview!.columns.map((col, cIdx) => (
                        <td key={cIdx} className={col.type === "number" ? "cell-number" : ""}>
                          {formatCellValue(row[cIdx], col.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. Detalhes avançados (JSON somente leitura) */}
        <details className="cv-details-advanced">
          <summary>Detalhes avançados</summary>
          <label className="op-field">
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Identificador técnico (avançado)</span>
              {!showAdvancedId && (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--cv-accent)",
                    cursor: "pointer",
                    fontSize: "11px",
                    padding: 0,
                  }}
                  onClick={() => setShowAdvancedId(true)}
                >
                  Editar id
                </button>
              )}
            </span>
            <input
              type="text"
              required={showAdvancedId}
              maxLength={50}
              className="cv-font-mono"
              placeholder="Ex.: faturamento_mensal"
              value={sourceModal.id || sourceModal.originalId || ""}
              onChange={(e) => handleIdChange(e.target.value)}
              readOnly={!showAdvancedId}
            />
            {idError && (
              <span className="inline-error" style={{ fontSize: "11px", marginTop: "2px" }}>
                {idError}
              </span>
            )}
          </label>

          <pre className="cv-json-preview">{JSON.stringify(draftSource, null, 2)}</pre>
        </details>
      </form>
    </InlineDialog>
  );
}
