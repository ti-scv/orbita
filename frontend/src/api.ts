import { canvasErrorMessage } from "./components/report-canvas/common/errorMessage";
let csrfToken = "";
export function apiUrl(url: string): string {
  const [path, search = ""] = url.split("?");
  if (!path.startsWith("/api/v1/") || path.startsWith("/api/v1/remote/"))
    return url;
  const params = new URLSearchParams(search);
  const unit = params.get("unit") || "";
  const match = unit.match(/^remote:([a-f0-9-]{36})$/i);
  if (!match) return url;
  params.delete("unit");
  const query = params.toString();
  return `/api/v1/remote/${match[1]}/${path.slice(8)}${query ? `?${query}` : ""}`;
}
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return ("" + 1e7 + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
    );
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  // Only retry read-only operations: a session lookup and source previews.
  const retryable = (method === "GET" && /\/auth\/session\//.test(url)) ||
    (method === "POST" && /\/canvas-(?:source-)?preview\//.test(url));
  const idempotencyKey = method === "POST" ? generateUUID() : "";
  let response: Response | undefined;
  for (let attempt = 0; attempt < (retryable ? 3 : 1); attempt++) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    signal?.addEventListener("abort", cancel, { once: true });
    let timedOut = false;
    const timer = retryable ? setTimeout(() => { timedOut = true; controller.abort(); }, 15000) : undefined;
    try {
      response = await fetch(apiUrl(url), {
        method,
        credentials: "same-origin",
        signal: retryable ? controller.signal : signal,
        headers: {
          "Content-Type": "application/json",
          ...(method !== "GET" ? { "X-CSRFToken": csrfToken } : {}),
          ...(method === "POST" ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!retryable || ![502, 504].includes(response.status)) break;
      if (attempt === 2) throw Object.assign(new Error("O servidor está temporariamente indisponível. Tente novamente em instantes."), { status: response.status });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!timedOut || attempt === 2) {
        if (timedOut) throw new Error("A consulta demorou demais. Tente novamente em instantes.");
        if (error instanceof TypeError && (retryable || /\/canvas(?:[/-]|$)/.test(url))) throw new Error("Não foi possível acessar o servidor. Confira a conexão e tente novamente.");
        throw error;
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
    await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
  }
  if (!response) throw new Error("Não foi possível acessar o servidor. Tente novamente.");
  if (response.status === 204) return undefined as T;
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw Object.assign(new Error(
      `O servidor retornou uma resposta inválida (HTTP ${response.status}). Tente novamente.`,
    ), { status: response.status });
  }
  if (!response.ok) {
    const error = new Error(
      /\/canvas(?:[/-]|$)/.test(url) ? canvasErrorMessage(data, body, response.status) :
      typeof data.detail === "string" ? data.detail : Object.values(data).flat().join(" ") || "Não foi possível concluir a operação.",
    );
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data as T;
}
export async function initCsrf() {
  csrfToken = (await request<{ csrfToken: string }>("/api/v1/auth/csrf/"))
    .csrfToken;
}
export async function signIn(username: string, password: string) {
  await initCsrf();
  const result = await request<{ csrfToken: string }>(
    "/api/v1/auth/login/",
    "POST",
    { username, password },
  );
  csrfToken = result.csrfToken;
}
export function query(path: string, filters: Record<string, string>) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  );
  return apiUrl(`/api/v1/${path}/?${params}`);
}
