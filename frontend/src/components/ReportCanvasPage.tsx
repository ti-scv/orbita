import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { query, request } from "../api";
const loadReportCanvas = () => import("./ReportCanvas");
const ReportCanvas = lazy(loadReportCanvas);
import type { CanvasGetResponse } from "./report-canvas/model";
import type { ReportSummary } from "./report-canvas/model";
import CanvasErrorBoundary from "./report-canvas/shell/CanvasErrorBoundary";
import ShellSkeleton from "./report-canvas/shell/ShellSkeleton";
import "./report-canvas/tokens.css";
import "./report-canvas/layout.css";
import "./report-canvas/shell.css";

export interface ReportCanvasPageProps {
  id: number;
  unit: string;
  admin: boolean;
}

export default function ReportCanvasPage({ id, unit, admin }: ReportCanvasPageProps) {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [initialCanvas, setInitialCanvas] = useState<CanvasGetResponse | undefined>();
  const [loadingStep, setLoadingStep] = useState("Carregando relatório…");
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const back = useCallback(() => {
    window.history.pushState({}, "", `/relatorios?unit=${encodeURIComponent(unit)}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [unit]);

  const retry = useCallback(() => {
    setError("");
    setReport(null);
    setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    setReport(null);
    setInitialCanvas(undefined);
    setError("");
    setLoadingStep("Carregando relatório…");
    if (admin) {
      performance.mark("canvas-abertura-inicio");
      void loadReportCanvas().catch(() => {});
      Promise.all([
        request<ReportSummary>(query(`reports/${id}`, { unit })).then(value => { performance.mark("canvas-definicao-pronta"); if (alive) setLoadingStep("Carregando fontes…"); return value; }),
        request<CanvasGetResponse>(query(`reports/${id}/canvas`, { unit })).then(value => { performance.mark("canvas-fontes-prontas"); return value; }),
      ])
        .then(([res, canvas]) => {
          if (alive) { setInitialCanvas(canvas); setReport(res); }
        })
        .catch((err: unknown) => {
          if (alive) {
            setError((err as Error).message || "Não foi possível carregar os dados do relatório.");
          }
        });
    }
    return () => {
      alive = false;
    };
  }, [id, unit, admin, reloadTick]);

  useEffect(() => {
    if (!report) return;
    const previous = document.title;
    document.title = `${report.name} · Desenho do relatório · SCV Messenger`;
    return () => {
      document.title = previous;
    };
  }, [report]);

  if (!admin || error) {
    const specificMessage = error || "Acesso administrativo necessário para editar este relatório.";
    return (
      <main className="cv-route-error-shell cv-root" aria-label="Editor de relatório">
        <header className="cv-topbar">
          <div className="cv-topbar-toolbar">
            <div className="cv-topbar-left">
              <button
                type="button"
                className="cv-btn cv-back-btn"
                aria-label="Voltar para Relatórios"
                onClick={back}
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Relatórios</span>
              </button>
            </div>
          </div>
        </header>
        <div className="cv-route-error-body">
          <section className="cv-route-error-panel" aria-labelledby="cv-route-error-title">
            <h1 id="cv-route-error-title">Falha ao abrir o editor</h1>
            <p className="cv-route-error-msg" role="alert">
              {specificMessage}
            </p>
            <div className="cv-route-error-actions">
              <button
                type="button"
                className="cv-btn cv-btn-primary"
                aria-label="Tentar novamente"
                onClick={retry}
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>Tentar novamente</span>
              </button>
              <button
                type="button"
                className="cv-btn"
                aria-label="Voltar para a lista de relatórios"
                onClick={back}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Voltar</span>
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!report) {
    return <ShellSkeleton label={loadingStep} />;
  }

  return <CanvasErrorBoundary key={`${unit}:${id}`} onBack={back}><Suspense fallback={<ShellSkeleton label="Montando a página…" />}><ReportCanvas key={`${unit}:${id}`} unit={unit} report={report} initialCanvas={initialCanvas} onClose={back} /></Suspense></CanvasErrorBoundary>;
}
