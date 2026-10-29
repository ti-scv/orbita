import type { CanvasLayout, OutputFormat } from "../model";
import { normalizeLayout, sanitizeLayoutForApi } from "../model";

function draftStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_DRAFT_BYTES = 700 * 1024; // 700 KB limit

export interface DraftPayload {
  layout: CanvasLayout;
  enabled: boolean;
  outputFormat: OutputFormat;
  timestamp: number;
}

export function getDraftStorageKey(unit: string, reportId: number, version: number): string {
  return `orbita:canvas_draft:${unit}:${reportId}:${version}`;
}

export function formatDraftTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(timestamp));
  } catch {
    const d = new Date(timestamp);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
}

export function saveDraftToStorage(
  unit: string,
  reportId: number,
  version: number,
  payload: {
    layout: CanvasLayout;
    enabled: boolean;
    outputFormat: OutputFormat;
  },
): boolean {
  const storage = draftStorage();
  if (!storage) {
    return false;
  }
  try {
    const key = getDraftStorageKey(unit, reportId, version);
    const sanitized = sanitizeLayoutForApi(payload.layout);
    const data: DraftPayload = {
      layout: sanitized,
      enabled: Boolean(payload.enabled),
      outputFormat: payload.outputFormat,
      timestamp: Date.now(),
    };
    const json = JSON.stringify(data);
    const byteLength =
      typeof Blob !== "undefined"
        ? new Blob([json]).size
        : new TextEncoder().encode(json).length;
    if (byteLength > MAX_DRAFT_BYTES) {
      return false;
    }
    storage.setItem(key, json);
    return true;
  } catch {
    return false;
  }
}

export function loadDraftFromStorage(
  unit: string,
  reportId: number,
  version: number,
): DraftPayload | null {
  const storage = draftStorage();
  if (!storage) {
    return null;
  }
  try {
    const key = getDraftStorageKey(unit, reportId, version);
    const prefix = `orbita:canvas_draft:${unit}:${reportId}:`;
    for (let i = storage.length - 1; i >= 0; i--) {
      const candidate = storage.key(i);
      if (candidate?.startsWith(prefix) && candidate !== key) storage.removeItem(candidate);
    }
    const item = storage.getItem(key);
    if (!item || new TextEncoder().encode(item).length > MAX_DRAFT_BYTES) return null;
    const parsed = JSON.parse(item) as DraftPayload;
    if (!parsed || !parsed.layout || parsed.layout.schema_version !== 1 || !Array.isArray(parsed.layout.pages) || !parsed.layout.pages.length || typeof parsed.enabled !== "boolean" || !["pdf", "xlsx"].includes(parsed.outputFormat) || !Number.isFinite(parsed.timestamp)) {
      return null;
    }
    if (parsed.timestamp > Date.now() || Date.now() - parsed.timestamp > MAX_DRAFT_AGE_MS) {
      storage.removeItem(key);
      return null;
    }
    return { ...parsed, layout: normalizeLayout(parsed.layout) };
  } catch {
    return null;
  }
}

export function clearDraftFromStorage(unit: string, reportId: number, version: number): void {
  const storage = draftStorage();
  if (!storage) {
    return;
  }
  try {
    const key = getDraftStorageKey(unit, reportId, version);
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function isDraftDifferent(
  draft: DraftPayload,
  current: {
    layout: CanvasLayout;
    enabled: boolean;
    outputFormat: OutputFormat;
  },
): boolean {
  if (draft.enabled !== current.enabled) return true;
  if (draft.outputFormat !== current.outputFormat) return true;
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  const draftSanitized = JSON.stringify(canonical(sanitizeLayoutForApi(draft.layout)));
  const currentSanitized = JSON.stringify(canonical(sanitizeLayoutForApi(current.layout)));
  return draftSanitized !== currentSanitized;
}
