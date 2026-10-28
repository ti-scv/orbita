import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSourcePreviewRequest, hashSourceSpec } from "../api/useSourcePreview";
import type { SourcePreviewState } from "../api/useSourcePreview";
import type { CanvasSource } from "../model";
import { isParameterBinding } from "../model";
import { query, request } from "../../../api";
import { testParameters, displayParameter, collectTestParameters } from "../parameters";
import type { TestParameter } from "../parameters";

export interface StagePreviewState extends SourcePreviewState {
  fields?: TestParameter[];
  values?: Record<string, string>;
  assumed?: boolean;
  changedParameters?: string[];
}

export function previewParameters(source: CanvasSource, schema: Record<string, unknown>, ownerSchema: Record<string, any> = {}, unit = "", now = new Date()) {
  const fields = testParameters(schema);
  const values: Record<string,string> = {};
  if (source.type !== "report") return {fields, values};
  for (const [name, value] of Object.entries(source.parameters || {})) {
    if (isParameterBinding(value) && !fields.some(f => f.name === name)) {
      fields.push(testParameters({[name]: {...ownerSchema[value.parameter], required: true}})[0]);
    }
  }
  const iso = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
  for (const field of fields) {
    const configured = source.parameters?.[field.name];
    const bound = isParameterBinding(configured);
    let value = bound ? ownerSchema[configured.parameter]?.default : configured;
    value = (value === "" ? undefined : value) ?? field.default ?? ownerSchema[field.name]?.default;
    const key = field.name.toLowerCase().replace(/^wpa_/, "");
    if ((value == null || value === "") && /^(unit|unit_slug|unidade)$/.test(key) && unit && (!field.options || field.options.some(option => option.value === unit))) value = unit;
    if (field.options && value != null && value !== "" && !field.options.some(option => option.value === String(value))) {
      value = field.options.some(option => option.value === String(field.default)) ? field.default : undefined;
      if (value == null) field.default = undefined;
    }
    if (value == null || value === "") {
      if (field.type === "date" || /^(start|end|start_date|end_date|data_inicial|data_final)$/.test(key)) {
        const date = new Date(now);
        if (/start|inicial|inicio/.test(key)) date.setDate(date.getDate()-30);
        value = iso(date);
      } else if (key === "year" || key === "ano") value = now.getFullYear();
      else if (key === "month" || key === "mes") value = now.getMonth()+1;
    }
    values[field.name] = displayParameter(value, field.type);
    if (bound && !values[field.name] && field.default == null) field.required = true;
  }
  return {fields, values};
}

export function previewPeriod(fields: TestParameter[] = [], values: Record<string,string> = {}) {
  return fields.filter(f => f.type === "date").map(f => values[f.name]?.slice(0,5)).filter(Boolean).join(" a ");
}

export function expandedPreviewParameters(fields: TestParameter[], values: Record<string,string>, now = new Date()) {
  const expanded = {...values};
  for (const field of fields) if (field.type === "date") {
    const date = new Date(now);
    if (/start|inicial|inicio/i.test(field.name)) date.setDate(date.getDate()-90);
    expanded[field.name] = [String(date.getDate()).padStart(2,"0"),String(date.getMonth()+1).padStart(2,"0"),date.getFullYear()].join("/");
  }
  return collectTestParameters(fields, expanded);
}

export function previewError(message = ""): string {
  if (/404|not found|não encontrad/i.test(message)) return "Fonte ou rota de prévia não encontrada. Verifique a fonte e tente de novo.";
  if (/403|forbidden|permission|permissão|permissões|CSRF/i.test(message)) return "Sem permissão para consultar esta fonte. Confira seu acesso e tente de novo.";
  if (/401|authentication|credentials/i.test(message)) return "Sua sessão expirou. Entre novamente para consultar a prévia.";
  if (/^(failed to fetch|network error)$/i.test(message)) return "Falha de conexão. Tente de novo.";
  return message || "Verifique a conexão e tente novamente.";
}

export function useStagePreviews(reportId: number, unit: string, sources: CanvasSource[], enabled: boolean, ownerSchema: Record<string, any> = {}) {
  const [entries, setEntries] = useState<Record<string, { key: string; state: StagePreviewState }>>({});
  const current = useRef({ reportId, unit, sources, ownerSchema, enabled });
  current.current = { reportId, unit, sources, ownerSchema, enabled };
  const runtimeParameters = useRef(new Map<string, Record<string, unknown>>());
  const pending = useRef(new Map<string, AbortController>());
  const keyFor = (source: CanvasSource) => `${unit}:${reportId}:${hashSourceSpec(source)}`;
  const states = useMemo(() => Object.fromEntries(sources.flatMap(source => {
    const entry = entries[source.id];
    return entry?.key === keyFor(source) ? [[source.id, entry.state]] : [];
  })), [entries, sources, unit, reportId]);
  const load = useCallback(async (sourceId: string, retry = false, parameters?: Record<string, unknown>) => {
    const snapshot = current.current;
    const source = snapshot.sources.find(s => s.id === sourceId);
    if (!source || source.type !== "report") return;
    const key = `${current.current.unit}:${current.current.reportId}:${hashSourceSpec(source)}`;
    if (pending.current.has(key) && !retry) return;
    if (parameters) runtimeParameters.current.set(key, parameters);
    parameters = parameters || runtimeParameters.current.get(key);
    pending.current.get(key)?.abort();
    const controller = new AbortController();
    pending.current.set(key, controller);
    const put = (state: StagePreviewState) => {
      const latest = current.current.sources.find(s => s.id === sourceId);
      if (!latest || `${current.current.unit}:${current.current.reportId}:${hashSourceSpec(latest)}` !== key) return;
      if (!controller.signal.aborted) setEntries(prev => ({ ...prev, [sourceId]: {key, state} }));
    };
    put({ status: "loading", data: null, error: null, loadedAt: null });
    const startedAt = performance.now();
    let fields: TestParameter[] = [], values: Record<string,string> = {};
    let changedParameters: string[] = [];
    try {
      const report = source.report_id === snapshot.reportId
        ? { parameter_schema: snapshot.ownerSchema }
        : await request<{parameter_schema?: Record<string, unknown>}>(query(`reports/${source.report_id}`, {unit: snapshot.unit}));
      ({fields, values} = previewParameters(source, report.parameter_schema || {}, snapshot.ownerSchema, snapshot.unit));
      if (parameters) {
        changedParameters = fields.filter(field => Object.prototype.hasOwnProperty.call(parameters, field.name) && displayParameter(parameters[field.name], field.type) !== values[field.name]).map(field => field.name);
        for (const field of fields) values[field.name] = displayParameter(parameters[field.name] ?? field.default, field.type);
      }
      const missing = fields.filter(f => f.required !== false && f.default == null && !values[f.name]?.trim());
      if (missing.length) {
        put({status: "idle", data: null, error: `Escolha ${missing.map(f => f.label).join(", ")} para ver a prévia.`, loadedAt: null, fields, values});
        return;
      }
      // Only this request receives resolved values; never change the layout/store.
      const resolved = {...source, parameters: {...source.parameters, ...collectTestParameters(fields, values)}} as typeof source;
      const data = await fetchSourcePreviewRequest(snapshot.reportId, snapshot.unit, resolved,
        {}, 50, controller.signal);
      put({ status: "ready", data, error: null, loadedAt: new Date(), fields, values, changedParameters, assumed: !parameters });
    } catch (err: any) {
      put({ status: "error", data: null, loadedAt: null, fields, values, changedParameters,
        httpStatus: typeof err?.status === "number" ? err.status : undefined,
        elapsedMs: Math.round(performance.now() - startedAt),
        error: `Não foi possível carregar a prévia. ${previewError(err?.message)}` });
    } finally { if (pending.current.get(key) === controller) pending.current.delete(key); }
  }, []);
  useEffect(() => {
    for (const [key, controller] of pending.current) {
      if (!sources.some(s => keyFor(s) === key)) { controller.abort(); pending.current.delete(key); }
    }
    if (enabled) for (const source of sources) {
      if (source.type === "report" && !states[source.id]) void load(source.id);
    }
  }, [enabled, sources, states, load]);
  useEffect(() => () => { for (const controller of pending.current.values()) controller.abort(); }, []);
  return { states, load };
}
