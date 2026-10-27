import type { CanvasBlock } from "../model";

export const PDF_LEGACY_PALETTE = [
  "#075b94",
  "#14b4cb",
  "#71bfa6",
  "#7289ba",
  "#af76b5",
  "#db9d49",
];

export const CHART_NEW_PALETTE = [
  "#075b94",
  "#c2610c",
  "#0f7f73",
  "#b5446e",
  "#0e8fa3",
  "#64748b",
];

export function resolveSeriesPalette(optColor?: string, customSeriesColors?: string[], chartType?: CanvasBlock["type"]): string[] {
  if (customSeriesColors && customSeriesColors.length > 0) {
    return customSeriesColors;
  }
  // Legacy PDF pies ignore options.color; bars/lines use it for series 1.
  const base = (chartType === "pie" ? undefined : optColor) || PDF_LEGACY_PALETTE[0];
  return [base, ...PDF_LEGACY_PALETTE.slice(1)];
}
