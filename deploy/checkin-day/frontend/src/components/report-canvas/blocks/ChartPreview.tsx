import { lazy, Suspense } from "react";
import type { ChartPreviewProps } from "./ChartPreviewContent";
export { PDF_LEGACY_PALETTE, CHART_NEW_PALETTE, resolveSeriesPalette } from "./chartPalette";
export type { ChartPreviewProps } from "./ChartPreviewContent";

// Tables/text and editor controls do not depend on the chart runtime.
const ChartContent = lazy(() => import("./ChartPreviewContent"));
export default function ChartPreview(props: ChartPreviewProps) {
  return <Suspense fallback={<div role="status">Carregando gráfico…</div>}>
    <ChartContent {...props} />
  </Suspense>;
}
