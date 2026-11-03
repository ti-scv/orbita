import { useState, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import { query, request } from "../api";
import type { SurveyAutomation, SurveyExecution } from "../types";
import InlineDialog from "./InlineDialog";
import {
  Trash2,
  Plus,
  RefreshCw,
  Search,
  ArrowRight,
  Database,
  FlaskConical,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  LockKeyhole,
  CheckCheck,
  MessageSquare,
  CalendarClock,
  History,
} from "lucide-react";

function getTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRelativeIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWhatsAppSurveyBody(
  body: string,
  patientCol: string,
  firstNameOnly: boolean
) {
  const parts = body.split(/(\{\{\d+\}\})/g);
  return parts.map((part, index) => {
    const match = part.match(/^\{\{(\d+)\}\}$/);
    if (match) {
      const key = match[1];
      if (key === "1") {
        if (patientCol) {
          const sampleName = firstNameOnly ? "Luiz" : "LUIZ APARECIDO MARTINS";
          return (
            <span
              key={index}
              className="whatsapp-filled-token"
              title={`Parâmetro {{1}} preenchido pela coluna ${patientCol}`}
            >
              {sampleName}
            </span>
          );
        }
        return (
          <span
            key={index}
            className="whatsapp-var-token"
            title="Parâmetro {{1}}: selecione a coluna do Nome do Paciente"
          >
            {"{{1}}"}
          </span>
        );
      }
      return (
        <span key={index} className="whatsapp-var-token">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface DBConnection {
  id: number;
  name: string;
  engine: string;
  database: string;
}

interface MetaTemplateItem {
  name: string;
  category?: string;
  language?: string;
  components?: any[];
  body_text?: string;
  body_variables?: string[];
  body_variables_count?: number;
  header_text?: string;
  has_url_button?: boolean;
  button_text?: string;
  button_url?: string;
  button_has_variable?: boolean;
  extracted_base_url?: string;
  is_survey_ready?: boolean;
}

interface ColumnItem {
  name: string;
  type: string;
}

const WEEKDAYS = [
  { id: 0, label: "Seg" },
  { id: 1, label: "Ter" },
  { id: 2, label: "Qua" },
  { id: 3, label: "Qui" },
  { id: 4, label: "Sex" },
  { id: 5, label: "Sáb" },
  { id: 6, label: "Dom" },
];

export default function SurveysWorkspace({
  unit,
  write,
  admin: _admin,
}: {
  unit: string;
  write: boolean;
  admin: boolean;
}) {
  const [tab, setTab] = useState<"automations" | "history">("automations");
  const [automations, setAutomations] = useState<SurveyAutomation[]>([]);
  const [executions, setExecutions] = useState<SurveyExecution[]>([]);
  const [connections, setConnections] = useState<DBConnection[]>([]);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  // Search, Date Filters & Pagination for History
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState(getTodayIso);
  const [historyEndDate, setHistoryEndDate] = useState(getTodayIso);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<SurveyAutomation | null>(null);

  // Form Fields State inside Modal
  const [formName, setFormName] = useState("");
  const [formConnection, setFormConnection] = useState<number | "">("");
  const [formTable, setFormTable] = useState("");
  const [formTemplate, setFormTemplate] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formScheduleType, setFormScheduleType] = useState<"daily_time" | "interval">("daily_time");
  const [formDischargePeriod, setFormDischargePeriod] = useState<"previous_day" | "same_day" | "lookback_hours">("previous_day");
  const [formInterval, setFormInterval] = useState(15);
  const [formWeekdays, setFormWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [formStartTime, setFormStartTime] = useState("08:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formLookback, setFormLookback] = useState(48);
  const [formBatchLimit, setFormBatchLimit] = useState(500);
  const [formEnabled, setFormEnabled] = useState(false);

  // Column Mapping
  const [inspectedColumns, setInspectedColumns] = useState<ColumnItem[]>([]);
  const [inspectingCols, setInspectingCols] = useState(false);
  const [colId, setColId] = useState("");
  const [colAttendance, setColAttendance] = useState("");
  const [colPatientName, setColPatientName] = useState("");
  const [colFirstNameOnly, setColFirstNameOnly] = useState(true);
  const [colPhone, setColPhone] = useState("");
  const [colStatus, setColStatus] = useState("");
  const [colAttendanceDate, setColAttendanceDate] = useState("");
  const [colSentDate, setColSentDate] = useState("");

  // Test Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTargetAutomation, setTestTargetAutomation] = useState<SurveyAutomation | null>(null);
  const [testAttendanceId, setTestAttendanceId] = useState("");
  const [testCustomPhone, setTestCustomPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [autoRes, connRes, tmplRes] = await Promise.all([
        request<SurveyAutomation[] | { results: SurveyAutomation[] }>(
          query("surveys/automations", { unit })
        ),
        request<{ results: DBConnection[] } | DBConnection[]>(
          query("surveys/connections", { unit })
        ).catch(() => ({ results: [] })),
        request<{ templates: MetaTemplateItem[] }>(
          query("surveys/meta-templates", { unit })
        ).catch(() => ({ templates: [] })),
      ]);

      const autos = Array.isArray(autoRes) ? autoRes : autoRes?.results || [];
      const conns = Array.isArray(connRes) ? connRes : connRes?.results || [];
      setAutomations(autos);
      setConnections(conns);
      setMetaTemplates(tmplRes.templates || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [unit]);

  const loadExecutions = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const filters: Record<string, string> = {
        unit,
        page: String(historyPage),
        page_size: String(historyPageSize),
      };
      if (search.trim()) filters.search = search.trim();
      if (statusFilter) filters.status = statusFilter;
      if (historyStartDate) filters.start_date = historyStartDate;
      if (historyEndDate) filters.end_date = historyEndDate;

      const res = await request<{
        results: SurveyExecution[];
        count: number;
        total_pages: number;
        page: number;
      }>(query("surveys/executions", filters));

      setExecutions(res.results || []);
      setHistoryTotal(res.count || 0);
      setHistoryTotalPages(res.total_pages || 1);
    } catch {
      // Ignora erro silencioso no log
    } finally {
      setHistoryLoading(false);
    }
  }, [
    unit,
    search,
    statusFilter,
    historyStartDate,
    historyEndDate,
    historyPage,
    historyPageSize,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab === "history") {
      void loadExecutions();
    }
  }, [tab, loadExecutions]);

  const applyTemplate = (tplName: string) => {
    setFormTemplate(tplName);
    const tpl = metaTemplates.find((t) => t.name === tplName);
    if (tpl?.extracted_base_url) {
      setFormBaseUrl(tpl.extracted_base_url);
    }
  };

  const openCreateModal = () => {
    setEditItem(null);
    setFormName("");
    setFormConnection("");
    setFormTable("");
    setFormTemplate("");
    setFormBaseUrl("");
    setFormScheduleType("daily_time");
    setFormDischargePeriod("previous_day");
    setFormInterval(15);
    setFormWeekdays([0, 1, 2, 3, 4]);
    setFormStartTime("08:00");
    setFormEndTime("18:00");
    setFormLookback(48);
    setFormBatchLimit(500);
    setFormEnabled(false);

    setColId("");
    setColAttendance("");
    setColPatientName("");
    setColFirstNameOnly(true);
    setColPhone("");
    setColStatus("");
    setColAttendanceDate("");
    setColSentDate("");
    setInspectedColumns([]);
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (auto: SurveyAutomation) => {
    setEditItem(auto);
    setFormName(auto.name);
    setFormConnection(auto.connection || "");
    setFormTable(auto.table_name);
    setFormTemplate(auto.template_name);
    setFormBaseUrl(auto.survey_base_url);
    setFormScheduleType(auto.schedule_type || "daily_time");
    setFormDischargePeriod(auto.discharge_period || "previous_day");
    setFormInterval(auto.interval_minutes);
    setFormWeekdays(auto.weekdays || [0, 1, 2, 3, 4]);
    setFormStartTime(auto.start_time?.slice(0, 5) || "08:00");
    setFormEndTime(auto.end_time?.slice(0, 5) || "18:00");
    setFormLookback(auto.lookback_hours);
    setFormBatchLimit(auto.batch_limit || 500);
    setFormEnabled(auto.enabled);

    const m = auto.column_mapping || {};
    setColId(m.id_column || "ID");
    setColAttendance(m.attendance_column || "CD_ATENDIMENTO");
    setColPatientName(m.patient_name_column || "NM_PACIENTE");
    setColFirstNameOnly(m.patient_first_name_only !== false);
    setColPhone(m.phone_column || "NR_CELULAR");
    setColStatus(m.status_column || "SN_ENVIADO");
    setColAttendanceDate(m.attendance_date_column || "DT_ALTA_MEDICA");
    setColSentDate(m.sent_date_column || "DT_ENVIO");
    setInspectedColumns([]);
    setError("");
    setModalOpen(true);
  };

  const handleInspectColumns = async () => {
    if (!formConnection || !formTable.trim()) {
      setError("Selecione a conexão de banco e informe o nome da tabela/view.");
      return;
    }
    setInspectingCols(true);
    setError("");
    try {
      const res = await request<{ columns: ColumnItem[] }>(
        query("surveys/inspect-columns", { unit }),
        "POST",
        {
          connection_id: formConnection,
          table_name: formTable.trim(),
        }
      );
      setInspectedColumns(res.columns || []);
      if (!res.columns || res.columns.length === 0) {
        setError("Nenhuma coluna encontrada para esta tabela ou view.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInspectingCols(false);
    }
  };

  const handleSaveAutomation = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formConnection || !formTable.trim()) {
      setError("Preencha o nome da automação, selecione a conexão e a tabela/view.");
      return;
    }
    setBusy(true);
    setError("");

    const columnMapping = {
      id_column: colId,
      attendance_column: colAttendance,
      patient_name_column: colPatientName,
      patient_first_name_only: colFirstNameOnly,
      phone_column: colPhone,
      status_column: colStatus,
      attendance_date_column: colAttendanceDate,
      sent_date_column: colSentDate,
    };

    const payload = {
      name: formName.trim(),
      connection: formConnection,
      table_name: formTable.trim(),
      column_mapping: columnMapping,
      template_name: formTemplate,
      template_language: "pt_BR",
      survey_base_url: formBaseUrl.trim(),
      button_parameter_type: "attendance_id",
      schedule_type: formScheduleType,
      discharge_period: formDischargePeriod,
      interval_minutes: Number(formInterval),
      weekdays: formWeekdays,
      start_time: formStartTime.length === 5 ? `${formStartTime}:00` : formStartTime,
      end_time: formEndTime.length === 5 ? `${formEndTime}:00` : formEndTime,
      lookback_hours: Number(formLookback),
      batch_limit: Number(formBatchLimit),
      enabled: formEnabled,
    };

    try {
      if (editItem) {
        await request(
          query(`surveys/automations/${editItem.id}`, { unit }),
          "PUT",
          payload
        );
      } else {
        await request(
          query("surveys/automations", { unit }),
          "POST",
          payload
        );
      }
      setModalOpen(false);
      setSuccessNotice(
        editItem ? "Automação atualizada com sucesso." : "Automação criada com sucesso."
      );
      setTimeout(() => setSuccessNotice(""), 4000);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (auto: SurveyAutomation) => {
    if (!window.confirm(`Deseja realmente excluir a automação "${auto.name}"?`)) {
      return;
    }
    setBusy(true);
    try {
      await request(query(`surveys/automations/${auto.id}`, { unit }), "DELETE");
      setSuccessNotice("Automação excluída com sucesso.");
      setTimeout(() => setSuccessNotice(""), 3000);
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerNow = async (auto: SurveyAutomation) => {
    setBusy(true);
    setError("");
    try {
      const res = await request<any>(
        query(`surveys/trigger/${auto.id}`, { unit }),
        "POST"
      );
      setSuccessNotice(
        `Ciclo executado: ${res.sent ?? 0} enviados, ${res.failed ?? 0} falhas, ${res.total_candidates ?? 0} candidatos.`
      );
      setTimeout(() => setSuccessNotice(""), 5000);
      await loadData();
      if (tab === "history") void loadExecutions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openTestModal = (auto: SurveyAutomation) => {
    setTestTargetAutomation(auto);
    setTestAttendanceId("");
    setTestCustomPhone("");
    setTestResult(null);
    setTestError("");
    setTestModalOpen(true);
  };

  const handleExecuteTest = async () => {
    if (!testAttendanceId.trim()) {
      setTestError("Informe o código de atendimento para o teste.");
      return;
    }
    if (!testTargetAutomation) return;

    setTesting(true);
    setTestError("");
    setTestResult(null);

    try {
      const res = await request<any>(
        query("surveys/test-send", { unit }),
        "POST",
        {
          automation_id: testTargetAutomation.id,
          attendance_id: testAttendanceId.trim(),
          test_phone: testCustomPhone.trim(),
        }
      );
      setTestResult(res);
    } catch (e) {
      setTestError((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const toggleWeekday = (dayId: number) => {
    setFormWeekdays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  return (
    <div className="surveys-workspace" style={{ padding: "20px 24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Pesquisas de Satisfação
          </h2>
          <span style={{ fontSize: "0.85rem", color: "var(--texto-mutado, #666)" }}>
            {automations.length} automação(ões) cadastrada(s) ·{" "}
            {automations.filter((a) => a.enabled).length} ativa(s)
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {write && (
            <button
              type="button"
              className="button primary compact"
              onClick={openCreateModal}
              disabled={busy}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} />
              <span>Nova Automação</span>
            </button>
          )}
          <button
            type="button"
            className="button secondary compact"
            onClick={() => void loadData()}
            disabled={busy || loading}
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <nav
        role="tablist"
        aria-label="Navegação de Pesquisas"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--borda, #ddd)",
          marginBottom: 16,
          paddingBottom: 2,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "automations"}
          onClick={() => setTab("automations")}
          className={`button tab ${tab === "automations" ? "active" : ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: tab === "automations" ? "var(--fundo-card, #fff)" : "none",
            border: "1px solid",
            borderColor: tab === "automations" ? "var(--borda, #cbd5e1)" : "transparent",
            borderBottom: tab === "automations" ? "2px solid var(--primaria, #0284c7)" : "2px solid transparent",
            borderRadius: "6px 6px 0 0",
            padding: "8px 16px",
            fontWeight: tab === "automations" ? 600 : 500,
            color: tab === "automations" ? "var(--primaria, #0284c7)" : "var(--texto-mutado, #64748b)",
            cursor: "pointer",
            fontSize: "0.9rem",
            transition: "all 0.15s ease",
          }}
        >
          <CalendarClock size={16} />
          <span>Automações e Crons</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          onClick={() => setTab("history")}
          className={`button tab ${tab === "history" ? "active" : ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: tab === "history" ? "var(--fundo-card, #fff)" : "none",
            border: "1px solid",
            borderColor: tab === "history" ? "var(--borda, #cbd5e1)" : "transparent",
            borderBottom: tab === "history" ? "2px solid var(--primaria, #0284c7)" : "2px solid transparent",
            borderRadius: "6px 6px 0 0",
            padding: "8px 16px",
            fontWeight: tab === "history" ? 600 : 500,
            color: tab === "history" ? "var(--primaria, #0284c7)" : "var(--texto-mutado, #64748b)",
            cursor: "pointer",
            fontSize: "0.9rem",
            transition: "all 0.15s ease",
          }}
        >
          <History size={16} />
          <span>Histórico de Disparos</span>
          {historyTotal > 0 && (
            <span
              style={{
                marginLeft: 4,
                padding: "1px 6px",
                borderRadius: 10,
                fontSize: "0.72rem",
                background: tab === "history" ? "rgba(2, 132, 199, 0.12)" : "var(--fundo-card, #e2e8f0)",
                color: tab === "history" ? "var(--primaria, #0284c7)" : "inherit",
                fontWeight: 600,
              }}
            >
              {historyTotal}
            </span>
          )}
        </button>
      </nav>

      {/* Alertas */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 6,
            background: "var(--vermelho-fundo, #fee2e2)",
            color: "var(--vermelho-texto, #991b1b)",
            border: "1px solid var(--vermelho-borda, #f87171)",
          }}
        >
          {error}
        </div>
      )}

      {successNotice && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 6,
            background: "var(--verde-fundo, #dcfce7)",
            color: "var(--verde-texto, #166534)",
            border: "1px solid var(--verde-borda, #86efac)",
          }}
        >
          {successNotice}
        </div>
      )}

      {/* Conteúdo da Aba Automações */}
      {tab === "automations" && (
        <div>
          {automations.length === 0 && !loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                border: "1px dashed var(--borda, #ccc)",
                borderRadius: 8,
              }}
            >
              <FlaskConical size={32} style={{ opacity: 0.5, marginBottom: 12 }} />
              <p style={{ margin: "0 0 12px", fontWeight: 500 }}>
                Nenhuma automação de pesquisa configurada nesta unidade.
              </p>
              {write && (
                <button
                  type="button"
                  className="button primary"
                  onClick={openCreateModal}
                >
                  <Plus size={15} style={{ marginRight: 6 }} />
                  Criar Primeira Automação
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--borda, #ddd)" }}>
                    <th style={{ padding: "10px 12px" }}>Automação</th>
                    <th style={{ padding: "10px 12px" }}>Origem (View / Banco)</th>
                    <th style={{ padding: "10px 12px" }}>Template Meta</th>
                    <th style={{ padding: "10px 12px" }}>Programação / Cron</th>
                    <th style={{ padding: "10px 12px" }}>Status</th>
                    <th style={{ padding: "10px 12px" }}>Último Disparo</th>
                    {write && <th style={{ padding: "10px 12px", textAlign: "right" }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {automations.map((auto) => {
                    const daysLabel = (auto.weekdays || [])
                      .map((d) => WEEKDAYS.find((w) => w.id === d)?.label)
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <tr
                        key={auto.id}
                        style={{ borderBottom: "1px solid var(--borda, #eee)" }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                          {auto.name}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "0.88rem" }}>
                          <code>{auto.table_name}</code>
                          <br />
                          <small style={{ color: "var(--texto-mutado, #666)" }}>
                            {auto.connection_name || "Sem conexão"}
                          </small>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "0.88rem" }}>
                          <span>{auto.template_name}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "0.85rem" }}>
                          {auto.schedule_type === "daily_time" ? (
                            <>
                              <div style={{ fontWeight: 600 }}>Diário às {auto.start_time?.slice(0, 5) || "08:00"}</div>
                              <div style={{ color: "var(--texto-mutado, #666)" }}>
                                {daysLabel || "Todos os dias"} · {auto.discharge_period === "previous_day" ? "Altas D-1 (ontem)" : auto.discharge_period === "same_day" ? "Altas D-0 (hoje)" : `Altas últimas ${auto.lookback_hours}h`}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600 }}>A cada {auto.interval_minutes} min</div>
                              <div style={{ color: "var(--texto-mutado, #666)" }}>
                                {daysLabel || "Todos os dias"} · {auto.start_time?.slice(0, 5)} às {auto.end_time?.slice(0, 5)}
                              </div>
                            </>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 12,
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              background: auto.enabled
                                ? "var(--verde-badge-fundo, #dcfce7)"
                                : "var(--cinza-badge-fundo, #f3f4f6)",
                              color: auto.enabled
                                ? "var(--verde-badge-texto, #15803d)"
                                : "var(--cinza-badge-texto, #6b7280)",
                            }}
                          >
                            {auto.enabled ? "Ativa" : "Pausada"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "0.85rem" }}>
                          {auto.last_run_at
                            ? new Date(auto.last_run_at).toLocaleString("pt-BR")
                            : "Nunca executado"}
                        </td>
                        {write && (
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                gap: 6,
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                type="button"
                                className="button compact secondary"
                                onClick={() => openTestModal(auto)}
                                title="Executar disparo de teste com atendimento específico"
                              >
                                Testar
                              </button>
                              <button
                                type="button"
                                className="button compact secondary"
                                onClick={() => void handleTriggerNow(auto)}
                                disabled={busy}
                                title="Disparar ciclo agora manualmente"
                              >
                                Disparar agora
                              </button>
                              <button
                                type="button"
                                className="button compact secondary"
                                onClick={() => openEditModal(auto)}
                                title="Editar configurações"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="button compact secondary danger"
                                onClick={() => void handleDelete(auto)}
                                disabled={busy}
                                title="Excluir automação"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da Aba Histórico */}
      {tab === "history" && (
        <div>
          {/* Barra de Filtros */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 16,
              background: "var(--fundo-card, #fff)",
              border: "1px solid var(--borda, #e5e7eb)",
              borderRadius: 8,
              padding: "12px 16px",
            }}
          >
            {/* Linha 1: Busca e Status */}
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
                <input
                  type="text"
                  placeholder="Buscar atendimento, paciente ou celular…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHistoryPage(1);
                  }}
                  style={{ width: "100%", paddingLeft: 28 }}
                />
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    opacity: 0.5,
                  }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setHistoryPage(1);
                }}
                style={{ minWidth: 160 }}
              >
                <option value="">Todos os status</option>
                <option value="sent">Enviados com sucesso</option>
                <option value="test">Testes</option>
                <option value="failed">Falhas de envio</option>
                <option value="skipped">Ignorados</option>
              </select>

              <button
                type="button"
                className="button compact secondary"
                onClick={() => void loadExecutions()}
                disabled={historyLoading}
                title="Atualizar histórico"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <RefreshCw size={13} className={historyLoading ? "spin" : ""} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Linha 2: Intervalo de Datas e Atalhos Rápidos */}
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                paddingTop: 8,
                borderTop: "1px solid var(--borda, #f3f4f6)",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--texto-mutado, #666)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontWeight: 500,
                  }}
                >
                  <Calendar size={13} /> De:
                </span>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => {
                    setHistoryStartDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  style={{ padding: "4px 8px", fontSize: "0.82rem" }}
                />
                <span style={{ fontSize: "0.82rem", color: "var(--texto-mutado, #666)" }}>até</span>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => {
                    setHistoryEndDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  style={{ padding: "4px 8px", fontSize: "0.82rem" }}
                />
              </div>

              {/* Botões de Atalho */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className={`button compact ${
                    historyStartDate === getTodayIso() && historyEndDate === getTodayIso()
                      ? "primary"
                      : "secondary"
                  }`}
                  onClick={() => {
                    const today = getTodayIso();
                    setHistoryStartDate(today);
                    setHistoryEndDate(today);
                    setHistoryPage(1);
                  }}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={`button compact ${
                    historyStartDate === getRelativeIso(1) && historyEndDate === getRelativeIso(1)
                      ? "primary"
                      : "secondary"
                  }`}
                  onClick={() => {
                    const yesterday = getRelativeIso(1);
                    setHistoryStartDate(yesterday);
                    setHistoryEndDate(yesterday);
                    setHistoryPage(1);
                  }}
                >
                  Ontem
                </button>
                <button
                  type="button"
                  className={`button compact ${
                    historyStartDate === getRelativeIso(6) && historyEndDate === getTodayIso()
                      ? "primary"
                      : "secondary"
                  }`}
                  onClick={() => {
                    setHistoryStartDate(getRelativeIso(6));
                    setHistoryEndDate(getTodayIso());
                    setHistoryPage(1);
                  }}
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  className={`button compact ${
                    !historyStartDate && !historyEndDate ? "primary" : "secondary"
                  }`}
                  onClick={() => {
                    setHistoryStartDate("");
                    setHistoryEndDate("");
                    setHistoryPage(1);
                  }}
                >
                  Todos
                </button>
              </div>

              {(historyStartDate || historyEndDate || search || statusFilter) && (
                <button
                  type="button"
                  className="button compact secondary"
                  onClick={() => {
                    const today = getTodayIso();
                    setSearch("");
                    setStatusFilter("");
                    setHistoryStartDate(today);
                    setHistoryEndDate(today);
                    setHistoryPage(1);
                  }}
                  title="Restaurar padrão (Hoje)"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto" }}
                >
                  <X size={12} />
                  <span>Redefinir</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--borda, #ddd)" }}>
                  <th style={{ padding: "8px 10px" }}>Data/Hora</th>
                  <th style={{ padding: "8px 10px" }}>Atendimento</th>
                  <th style={{ padding: "8px 10px" }}>Paciente</th>
                  <th style={{ padding: "8px 10px" }}>Celular</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px" }}>Link da Pesquisa</th>
                  <th style={{ padding: "8px 10px" }}>Detalhes / Erro</th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px 16px" }}>
                      <p style={{ margin: "0 0 8px 0", color: "var(--texto-mutado, #666)" }}>
                        {historyStartDate || historyEndDate
                          ? "Nenhum disparo encontrado para a data/período selecionado."
                          : "Nenhum disparo registrado no histórico."}
                      </p>
                      {(historyStartDate || historyEndDate) && (
                        <button
                          type="button"
                          className="button compact secondary"
                          onClick={() => {
                            setHistoryStartDate("");
                            setHistoryEndDate("");
                            setHistoryPage(1);
                          }}
                        >
                          Ver todo o histórico (sem filtro de data)
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  executions.map((ex) => (
                    <tr key={ex.id} style={{ borderBottom: "1px solid var(--borda, #eee)" }}>
                      <td style={{ padding: "8px 10px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {new Date(ex.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                        {ex.attendance_id}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{ex.patient_name || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: "0.85rem" }}>{ex.phone}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background:
                              ex.status === "sent"
                                ? "var(--verde-badge-fundo, #dcfce7)"
                                : ex.status === "test"
                                ? "var(--azul-badge-fundo, #dbeafe)"
                                : "var(--vermelho-badge-fundo, #fee2e2)",
                            color:
                              ex.status === "sent"
                                ? "var(--verde-badge-texto, #15803d)"
                                : ex.status === "test"
                                ? "var(--azul-badge-texto, #1d4ed8)"
                                : "var(--vermelho-badge-texto, #b91c1c)",
                          }}
                        >
                          {ex.status === "sent"
                            ? "Enviado"
                            : ex.status === "test"
                            ? "Teste"
                            : ex.status === "failed"
                            ? "Falha"
                            : ex.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: "0.85rem" }}>
                        {ex.survey_url ? (
                          <a
                            href={ex.survey_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <span>Abrir link</span>
                            <ArrowRight size={12} />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: "0.82rem", color: "var(--vermelho-texto, #b91c1c)" }}>
                        {ex.error_message || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação e Resumo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid var(--borda, #eee)",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: "0.85rem",
                color: "var(--texto-mutado, #666)",
              }}
            >
              <span>
                {historyTotal === 0
                  ? "0 registros"
                  : `Mostrando ${(historyPage - 1) * historyPageSize + 1} a ${Math.min(
                      historyPage * historyPageSize,
                      historyTotal
                    )} de ${historyTotal} registros`}
              </span>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span>Itens por página:</span>
                <select
                  value={historyPageSize}
                  onChange={(e) => {
                    setHistoryPageSize(Number(e.target.value));
                    setHistoryPage(1);
                  }}
                  style={{ padding: "2px 6px", fontSize: "0.82rem" }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="button compact secondary"
                disabled={historyPage <= 1 || historyLoading}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <ChevronLeft size={14} />
                <span>Anterior</span>
              </button>
              <span style={{ fontSize: "0.85rem", padding: "0 6px" }}>
                Página {historyPage} de {historyTotalPages}
              </span>
              <button
                type="button"
                className="button compact secondary"
                disabled={historyPage >= historyTotalPages || historyLoading}
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <span>Próxima</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração (InlineDialog) */}
      {modalOpen && (
        <InlineDialog
          title={editItem ? "Editar Automação de Pesquisa" : "Nova Automação de Pesquisa"}
          subtitle=""
          busy={busy}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalOpen(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button primary"
                form="survey-config-form"
                disabled={busy}
              >
                {editItem ? "Salvar Alterações" : "Criar Automação"}
              </button>
            </>
          }
        >
          <form id="survey-config-form" onSubmit={handleSaveAutomation}>
            {/* Fieldset: Identificação */}
            <fieldset style={{ border: "1px solid var(--borda, #ddd)", borderRadius: 6, padding: "12px 14px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 600, fontSize: "0.9rem" }}>Identificação</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                <label>
                  <span>Nome da Automação</span>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex.: Pesquisa NPS Sansaúde Pós-Alta"
                  />
                </label>
                <label className="checkbox-label" style={{ marginTop: 20 }}>
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                  />
                  <span>Automação ativa</span>
                </label>
              </div>
            </fieldset>

            {/* Fieldset: Origem dos Dados (View/Tabela no Banco) */}
            <fieldset style={{ border: "1px solid var(--borda, #ddd)", borderRadius: 6, padding: "12px 14px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 600, fontSize: "0.9rem" }}>Origem dos Dados (Banco / View)</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                <label>
                  <span>Conexão de Banco</span>
                  <select
                    required
                    value={formConnection}
                    onChange={(e) => setFormConnection(Number(e.target.value) || "")}
                  >
                    <option value="">Selecione a conexão...</option>
                    {connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.engine} · {c.database})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Tabela ou View</span>
                  <input
                    type="text"
                    required
                    value={formTable}
                    onChange={(e) => setFormTable(e.target.value)}
                    placeholder="dbasistemas.rf_tbl_msg_alta_med_san"
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={handleInspectColumns}
                  disabled={inspectingCols || !formConnection || !formTable.trim()}
                >
                  <Database size={14} style={{ marginRight: 6 }} />
                  {inspectingCols ? "Inspecionando colunas..." : "Carregar Colunas da Tabela/View"}
                </button>
                {inspectedColumns.length > 0 && (
                  <span style={{ fontSize: "0.82rem", color: "var(--verde-texto, #15803d)" }}>
                    ✓ {inspectedColumns.length} colunas carregadas com sucesso
                  </span>
                )}
              </div>
            </fieldset>

            {/* Fieldset: Mapeamento de Colunas */}
            <fieldset style={{ border: "1px solid var(--borda, #ddd)", borderRadius: 6, padding: "12px 14px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 600, fontSize: "0.9rem" }}>Mapeamento das Colunas</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span>Coluna do ID / Chave Primária</span>
                  {inspectedColumns.length > 0 ? (
                    <select value={colId} onChange={(e) => setColId(e.target.value)}>
                      <option value="">Selecione a coluna...</option>
                      {inspectedColumns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Ex: ID" value={colId} onChange={(e) => setColId(e.target.value)} />
                  )}
                </label>

                <label>
                  <span>Coluna do Atendimento (atendimento=)</span>
                  {inspectedColumns.length > 0 ? (
                    <select value={colAttendance} onChange={(e) => setColAttendance(e.target.value)}>
                      <option value="">Selecione a coluna...</option>
                      {inspectedColumns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Ex: CD_ATENDIMENTO" value={colAttendance} onChange={(e) => setColAttendance(e.target.value)} />
                  )}
                </label>

                <label>
                  <span>Coluna do Nome do Paciente</span>
                  {inspectedColumns.length > 0 ? (
                    <select value={colPatientName} onChange={(e) => setColPatientName(e.target.value)}>
                      <option value="">Selecione a coluna...</option>
                      {inspectedColumns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Ex: NM_PACIENTE" value={colPatientName} onChange={(e) => setColPatientName(e.target.value)} />
                  )}
                </label>

                <label>
                  <span>Coluna do Celular / WhatsApp</span>
                  {inspectedColumns.length > 0 ? (
                    <select value={colPhone} onChange={(e) => setColPhone(e.target.value)}>
                      <option value="">Selecione a coluna...</option>
                      {inspectedColumns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Ex: NR_CELULAR" value={colPhone} onChange={(e) => setColPhone(e.target.value)} />
                  )}
                </label>

                <label>
                  <span>Coluna de Status de Envio (opcional)</span>
                  {inspectedColumns.length > 0 ? (
                    <select value={colStatus} onChange={(e) => setColStatus(e.target.value)}>
                      <option value="">(Não filtrar por coluna de status)</option>
                      {inspectedColumns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Ex: SN_ENVIADO" value={colStatus} onChange={(e) => setColStatus(e.target.value)} />
                  )}
                </label>

                <label>
                  <span>Coluna Data de Alta / Atendimento</span>
                  {inspectedColumns.length > 0 ? (
                    <select value={colAttendanceDate} onChange={(e) => setColAttendanceDate(e.target.value)}>
                      <option value="">Selecione a coluna...</option>
                      {inspectedColumns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Ex: DT_ALTA_MEDICA" value={colAttendanceDate} onChange={(e) => setColAttendanceDate(e.target.value)} />
                  )}
                </label>
              </div>

              <label className="checkbox-label" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={colFirstNameOnly}
                  onChange={(e) => setColFirstNameOnly(e.target.checked)}
                />
                <span>Formatar para usar apenas o primeiro nome na saudação (ex.: "Olá Luiz" em vez de "LUIZ APARECIDO MARTINS")</span>
              </label>
            </fieldset>

            {/* Fieldset: Template da Meta */}
            {(() => {
              const selectedTpl = metaTemplates.find((t) => t.name === formTemplate);
              return (
                <fieldset style={{ border: "1px solid var(--borda, #ddd)", borderRadius: 6, padding: "12px 14px", marginBottom: 14 }}>
                  <legend style={{ fontWeight: 600, fontSize: "0.9rem" }}>Template da Meta (WhatsApp Business)</legend>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <label>
                      <span>Template Aprovado</span>
                      <select
                        value={formTemplate}
                        onChange={(e) => applyTemplate(e.target.value)}
                      >
                        <option value="">Selecione um template da Meta...</option>
                        {metaTemplates.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name} {t.is_survey_ready ? "✓ (Pesquisa NPS)" : `(${t.category || "Template"})`}
                          </option>
                        ))}
                        {formTemplate && !metaTemplates.some((t) => t.name === formTemplate) && (
                          <option value={formTemplate}>{formTemplate}</option>
                        )}
                      </select>
                    </label>

                    <label>
                      <span>URL Externa da Pesquisa</span>
                      <input
                        type="url"
                        required
                        value={formBaseUrl}
                        onChange={(e) => setFormBaseUrl(e.target.value)}
                        placeholder="https://pesqfy.santacasavotuporanga.com.br/survey/..."
                      />
                    </label>
                  </div>

                  {/* Prévia do WhatsApp no estilo Oficial (igual à Agenda) */}
                  {selectedTpl ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* WhatsApp Chat Frame & Bubble Preview */}
                      <div className="whatsapp-chat-frame">
                        <div className="whatsapp-chat-header">
                          <div className="whatsapp-avatar">
                            <MessageSquare size={16} />
                          </div>
                          <div className="whatsapp-header-info">
                            <div className="whatsapp-header-name">
                              <span>Órbita · WhatsApp Oficial</span>
                              <span
                                className="whatsapp-verified-badge"
                                title="Conta Comercial Verificada"
                              >
                                ✓
                              </span>
                            </div>
                            <span className="whatsapp-header-sub">
                              Conta comercial oficial
                            </span>
                          </div>
                        </div>

                        <div className="whatsapp-chat-wallpaper">
                          <div className="whatsapp-encryption-notice">
                            <span>
                              <LockKeyhole size={14} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                              Mensagem protegida com criptografia de ponta a ponta
                            </span>
                          </div>

                          <div className="whatsapp-bubble-wrapper">
                            <div className="whatsapp-message-bubble">
                              {selectedTpl.header_text && (
                                <div className="whatsapp-bubble-header">
                                  {selectedTpl.header_text}
                                </div>
                              )}
                              <div className="whatsapp-bubble-body">
                                {formatWhatsAppSurveyBody(
                                  selectedTpl.body_text || "",
                                  colPatientName,
                                  colFirstNameOnly
                                )}
                              </div>
                              <div className="whatsapp-time-row">
                                <span className="whatsapp-time-text">
                                  {formStartTime || "08:00"}
                                </span>
                                <CheckCheck
                                  size={16}
                                  className="whatsapp-double-check"
                                  aria-hidden="true"
                                />
                              </div>

                              {selectedTpl.button_text && (
                                <div className="whatsapp-bubble-buttons">
                                  <div className="whatsapp-bubble-button">
                                    <ArrowRight size={13} style={{ transform: "rotate(-45deg)" }} />
                                    <span>{selectedTpl.button_text}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card de Validação e Parâmetros */}
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: `1px solid ${
                            selectedTpl.is_survey_ready
                              ? "rgba(16, 185, 129, 0.4)"
                              : "rgba(245, 158, 11, 0.5)"
                          }`,
                          background: selectedTpl.is_survey_ready
                            ? "rgba(16, 185, 129, 0.05)"
                            : "rgba(245, 158, 11, 0.08)",
                          fontSize: "0.82rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <strong style={{ color: selectedTpl.is_survey_ready ? "#059669" : "#d97706" }}>
                            {selectedTpl.is_survey_ready
                              ? "✓ Template Validado para Pesquisa"
                              : "⚠️ Validação dos Parâmetros do Template"}
                          </strong>
                          <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                            {selectedTpl.body_variables_count || 0} variável(is) no texto ·{" "}
                            {selectedTpl.button_has_variable ? "Botão dinâmico configurado" : "Sem botão dinâmico"}
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <div style={{ padding: "6px 8px", background: "var(--bg-surface, #fff)", borderRadius: 4, border: "1px solid var(--border-default, #e2e8f0)" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--texto-mutado, #666)", display: "block" }}>
                              Variável {"{{1}}"} do Corpo da Mensagem
                            </span>
                            <strong>Nome do Paciente: </strong>
                            <code>{colPatientName || "(selecione a coluna do nome)"}</code>
                          </div>

                          <div style={{ padding: "6px 8px", background: "var(--bg-surface, #fff)", borderRadius: 4, border: "1px solid var(--border-default, #e2e8f0)" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--texto-mutado, #666)", display: "block" }}>
                              Variável do Botão Interativo (URL)
                            </span>
                            {selectedTpl.button_has_variable ? (
                              <>
                                <strong>Código do Atendimento: </strong>
                                <code>{colAttendance || "(selecione a coluna de atendimento)"}</code>
                              </>
                            ) : (
                              <span style={{ color: "#d97706" }}>Este template não possui botão dinâmico</span>
                            )}
                          </div>
                        </div>

                        <div style={{ padding: "6px 8px", background: "var(--bg-surface, #fff)", borderRadius: 4, border: "1px solid var(--border-default, #e2e8f0)", wordBreak: "break-all" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--texto-mutado, #666)", display: "block" }}>
                            Link Final da Pesquisa gerado para o paciente
                          </span>
                          {formBaseUrl ? (
                            <code>
                              {formBaseUrl}?atendimento={colAttendance ? "[Código de Atendimento]" : "..."}
                            </code>
                          ) : (
                            <span style={{ color: "#d97706" }}>Informe a URL externa da pesquisa acima</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.82rem", color: "var(--texto-mutado, #666)", padding: "10px 0" }}>
                      Selecione um template aprovado da Meta para visualizar a prévia interativa do WhatsApp e a validação das variáveis.
                    </div>
                  )}
                </fieldset>
              );
            })()}

            {/* Fieldset: Agendamento & Janela Operacional (Crons) */}
            <fieldset style={{ border: "1px solid var(--borda, #ddd)", borderRadius: 6, padding: "12px 14px", marginBottom: 14 }}>
              <legend style={{ fontWeight: 600, fontSize: "0.9rem" }}>Programação da Cron & Horários</legend>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <label>
                  <span>Frequência da Execução</span>
                  <select
                    value={formScheduleType}
                    onChange={(e) => setFormScheduleType(e.target.value as "daily_time" | "interval")}
                  >
                    <option value="daily_time">Horário fixo do dia (ex.: às 08:00)</option>
                    <option value="interval">Intervalo contínuo (a cada X minutos)</option>
                  </select>
                </label>

                {formScheduleType === "daily_time" ? (
                  <label>
                    <span>Horário do Disparo Diário</span>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                    />
                  </label>
                ) : (
                  <label>
                    <span>Intervalo de Execução</span>
                    <select
                      value={formInterval}
                      onChange={(e) => setFormInterval(Number(e.target.value))}
                    >
                      <option value={5}>A cada 5 minutos</option>
                      <option value={10}>A cada 10 minutos</option>
                      <option value={15}>A cada 15 minutos</option>
                      <option value={30}>A cada 30 minutos</option>
                      <option value={60}>A cada 1 hora</option>
                    </select>
                  </label>
                )}
              </div>

              {formScheduleType === "interval" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <label>
                    <span>Horário Início da Janela</span>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Horário Término da Janela</span>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                    />
                  </label>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, display: "block", marginBottom: 6 }}>
                  Dias da Semana Permitidos
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  {WEEKDAYS.map((w) => {
                    const isChecked = formWeekdays.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWeekday(w.id)}
                        className={`button compact ${isChecked ? "primary" : "secondary"}`}
                        style={{ minWidth: 44 }}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: formDischargePeriod === "lookback_hours" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
                <label>
                  <span>Filtro de Altas a Processar</span>
                  <select
                    value={formDischargePeriod}
                    onChange={(e) => setFormDischargePeriod(e.target.value as "previous_day" | "same_day" | "lookback_hours")}
                  >
                    <option value="previous_day">Altas do dia anterior (D-1) — 00:00 às 23:59</option>
                    <option value="same_day">Altas do mesmo dia (D-0)</option>
                    <option value="lookback_hours">Últimas X horas retroativas</option>
                  </select>
                </label>

                {formDischargePeriod === "lookback_hours" && (
                  <label>
                    <span>Horas Retroativas</span>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={formLookback}
                      onChange={(e) => setFormLookback(Number(e.target.value))}
                    />
                  </label>
                )}

                <label>
                  <span>Limite Máximo de Envios</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={formBatchLimit}
                    onChange={(e) => setFormBatchLimit(Number(e.target.value))}
                    title="Limite de pacientes por ciclo (padrão 500 para altas do dia anterior)"
                  />
                </label>
              </div>

              {formDischargePeriod === "previous_day" && (
                <div style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--texto-mutado, #666)" }}>
                  Serão selecionados todos os pacientes com alta médica registrada no dia anterior ({colAttendanceDate || "DT_ALTA_MEDICA"} entre 00:00 e 23:59 de ontem).
                </div>
              )}
            </fieldset>
          </form>
        </InlineDialog>
      )}

      {/* Modal de Disparo de Teste (InlineDialog) */}
      {testModalOpen && testTargetAutomation && (
        <InlineDialog
          title="Disparo de Teste de Pesquisa"
          subtitle={testTargetAutomation.name}
          busy={testing}
          onClose={() => setTestModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="button secondary"
                onClick={() => setTestModalOpen(false)}
                disabled={testing}
              >
                Fechar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleExecuteTest}
                disabled={testing || !testAttendanceId.trim()}
              >
                {testing ? "Executando Teste..." : "Disparar Teste"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--texto-mutado, #666)" }}>
              Informe um código de atendimento existente na view <code>{testTargetAutomation.table_name}</code> para simular a extração e o envio.
            </p>

            <label>
              <span>Código de Atendimento Teste</span>
              <input
                type="text"
                required
                placeholder="Ex.: 4307337"
                value={testAttendanceId}
                onChange={(e) => setTestAttendanceId(e.target.value)}
              />
            </label>

            <label>
              <span>Celular de Destino para o Teste (Opcional)</span>
              <input
                type="text"
                placeholder="Ex.: 17999999999 (deixe vazio para usar o celular gravado no atendimento)"
                value={testCustomPhone}
                onChange={(e) => setTestCustomPhone(e.target.value)}
              />
              <small style={{ color: "var(--texto-mutado, #666)" }}>
                Recomendado informar seu próprio WhatsApp para não disparar para o paciente real durante testes.
              </small>
            </label>

            {testError && (
              <div
                role="alert"
                style={{
                  padding: "10px",
                  borderRadius: 6,
                  background: "var(--vermelho-fundo, #fee2e2)",
                  color: "var(--vermelho-texto, #991b1b)",
                  fontSize: "0.88rem",
                }}
              >
                {testError}
              </div>
            )}

            {testResult && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: 6,
                  background: testResult.send_result?.success
                    ? "var(--verde-fundo, #dcfce7)"
                    : "var(--vermelho-fundo, #fee2e2)",
                  border: "1px solid var(--borda, #ddd)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {testResult.send_result?.success
                    ? "✓ Teste executado com sucesso!"
                    : "✕ Falha no disparo do teste"}
                </div>
                <div style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
                  <div><strong>Paciente no Oracle:</strong> {testResult.candidate?.patient_name}</div>
                  <div><strong>Celular de Envio:</strong> {testResult.send_result?.payload?.to || testResult.candidate?.phone}</div>
                  <div><strong>Link Gerado:</strong> <code>{testResult.survey_url}</code></div>
                  {testResult.send_result?.error && (
                    <div style={{ color: "var(--vermelho-texto, #991b1b)", marginTop: 6 }}>
                      <strong>Erro Meta:</strong> {testResult.send_result.error}
                    </div>
                  )}
                  {testResult.send_result?.message_id && (
                    <div><strong>Message ID Meta:</strong> {testResult.send_result.message_id}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </InlineDialog>
      )}
    </div>
  );
}
