import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onBack: () => void;
  onRetry?: () => void;
  // The inner boundary leaves the store/session mounted above the failed UI.
  preservesEditor?: boolean;
  dirty?: boolean;
}

export default class CanvasErrorBoundary extends Component<
  Props,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[Canvas] Falha ao renderizar o editor",
      error,
      info.componentStack,
    );
  }
  retry = () => {
    if (
      !this.props.preservesEditor &&
      !window.confirm(
        "Reabrir o editor pode descartar alterações ainda não salvas. Deseja continuar?",
      )
    )
      return;
    this.props.onRetry?.();
    this.setState({ failed: false });
  };
  back = () => {
    if (
      (!this.props.preservesEditor || this.props.dirty) &&
      !window.confirm(
        "Há alterações que podem não estar salvas. Voltar à lista pode descartá-las. Deseja continuar?",
      )
    )
      return;
    this.props.onBack();
  };
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        className="cv-root cv-route-error-shell"
        aria-label="Erro no editor de relatório"
      >
        <div className="cv-route-error-body">
          <section className="cv-route-error-panel" role="alert">
            <h1>Algo deu errado nesta tela. Seus dados não foram perdidos.</h1>
            <p>
              {this.props.preservesEditor
                ? "As alterações do Canvas continuam nesta sessão. Tente de novo para retomar a edição."
                : "Os dados salvos continuam no servidor. Reabrir pode descartar alterações ainda não salvas; confirme antes de continuar."}
            </p>
            <div className="cv-route-error-actions">
              <button
                type="button"
                className="cv-btn cv-btn-primary"
                onClick={this.retry}
              >
                Tentar de novo
              </button>
              <button type="button" className="cv-btn" onClick={this.back}>
                Voltar à lista
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }
}
