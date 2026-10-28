import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CanvasLayout, OutputFormat } from "../model";
import { collectTestParameters, previewUrlError, displayParameter, friendlyParameterValue, testParameters } from "../parameters";
import type { PreviewModalState, PreviewServerError } from "./PreviewDialog";

export function usePreviewDialog({
  parameterSchema,
  outputFormat,
  validateBeforeSend,
  previewCanvas,
  trackDownloadUrl,
  revokeDownloadUrl,
}: {
  parameterSchema?: Record<string, unknown>;
  outputFormat: OutputFormat;
  validateBeforeSend: (requireAtLeastOneBlock: boolean) => CanvasLayout | null;
  previewCanvas: (params: {
    layout: CanvasLayout;
    parameters: Record<string, unknown>;
    format: OutputFormat;
  }) => Promise<{ blob: Blob; filename: string; format: string; info: string }>;
  trackDownloadUrl: (blob: Blob) => string;
  revokeDownloadUrl: (url?: string) => void;
}) {
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const previewFields = useMemo(
    () => testParameters(parameterSchema || {}),
    [parameterSchema],
  );

  const openPreviewDialog = useCallback(() => {
    const clean = validateBeforeSend(true);
    if (!clean) return;
    const values = Object.fromEntries(
        previewFields.map((f) => {
          let value = f.default;
          if ((value == null || value === "") && f.type === "date" && /^(start|end|start_date|end_date|data_inicial|data_final)$/i.test(f.name)) {
            const date = new Date();
            if (/start|inicial/i.test(f.name)) date.setDate(date.getDate() - 30);
            value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          }
          return [f.name, /^(unidade|unit|tipo_envio)$/i.test(f.name) && !f.options && value != null && value !== "" ? friendlyParameterValue(f.name, value) : displayParameter(value, f.type)];
        }),
      );
    setPreviewModal({
      format: outputFormat,
      values,
      defaultPeriod: previewFields.filter(f => f.type === "date").map(f => values[f.name]).filter(Boolean).join(" a "),
      busy: false,
      error: previewUrlError(parameterSchema || {}, window.location.search),
      info: "",
      serverErrors: [],
    });
  }, [outputFormat, parameterSchema, previewFields, validateBeforeSend]);

  const closePreviewDialog = useCallback(() => {
    if (previewModal?.busy) return;
    revokeDownloadUrl(previewModal?.resultUrl);
    setPreviewModal(null);
  }, [previewModal, revokeDownloadUrl]);

  const handleRunPreview = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!previewModal) return;
      const urlError = previewUrlError(parameterSchema || {}, window.location.search);
      if (urlError) { setPreviewModal({...previewModal, error: urlError}); return; }
      const clean = validateBeforeSend(true);
      if (!clean) return;
      let parsedParams: Record<string, unknown>;
      try {
        parsedParams = collectTestParameters(previewFields, previewModal.values);
      } catch (err) {
        setPreviewModal({ ...previewModal, error: (err as Error).message });
        return;
      }
      setPreviewModal((curr) =>
        curr
          ? {
              ...curr,
              busy: true,
              error: "",
              info: "",
              serverErrors: [],
            }
          : null,
      );
      const t0 = performance.now();
      try {
        const res = await previewCanvas({
          layout: clean,
          parameters: parsedParams,
          format: previewModal.format,
        });
        const duration = Math.round(performance.now() - t0);
        const url = trackDownloadUrl(res.blob);
        revokeDownloadUrl(previewModal.resultUrl);
        setPreviewModal((curr) =>
          curr
            ? {
                ...curr,
                busy: false,
                resultUrl: url,
                resultName: res.filename,
                resultFormat: res.format,
                generationTimeMs: duration,
                serverErrors: [],
                info: res.info,
              }
            : null,
        );
      } catch (err) {
        const duration = Math.round(performance.now() - t0);
        const rawMsg = (err as Error).message || "Falha ao gerar prévia.";
        const blockMatch = rawMsg.match(/Bloco\s+"([^"]+)"|Gráfico\s+"([^"]+)"/);
        const serverErrors: PreviewServerError[] = [];
        if (blockMatch) {
          serverErrors.push({
            blockId: blockMatch[1] || blockMatch[2],
            message: rawMsg,
          });
        }
        setPreviewModal((curr) =>
          curr
            ? {
                ...curr,
                busy: false,
                error: rawMsg,
                generationTimeMs: duration,
                serverErrors,
              }
            : null,
        );
      }
    },
    [previewCanvas, previewFields, previewModal, parameterSchema, revokeDownloadUrl, trackDownloadUrl, validateBeforeSend],
  );

  return {
    previewModal,
    setPreviewModal,
    previewFields,
    openPreviewDialog,
    closePreviewDialog,
    handleRunPreview,
  };
}
