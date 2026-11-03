import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("API response handling", () => {
  it("reports an HTML server error without exposing its body or JSON parser error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html><html>Internal error</html>", {status:500, headers:{"Content-Type":"text/html"}})));
    await expect(request("/api/v1/reports/17/")).rejects.toThrow("resposta inválida (HTTP 500)");
  });
  it("preserves API validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:"Código já cadastrado."}), {status:400})));
    await expect(request("/api/v1/reports/", "POST", {})).rejects.toThrow("Código já cadastrado.");
  });
  it("retries a transient session error but does not retry validation failures", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("erro", {status:502})).mockResolvedValueOnce(new Response(JSON.stringify({username:"qa"}), {status:200}));
    vi.stubGlobal("fetch", fetcher);
    await expect(request("/api/v1/auth/session/")).resolves.toEqual({username:"qa"});
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockReset().mockResolvedValue(new Response(JSON.stringify({detail:"Inválido"}), {status:400}));
    await expect(request("/api/v1/reports/1/canvas-validate/", "POST", {})).rejects.toThrow("Inválido");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("accepts an empty successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, {status:204})));
    await expect(request("/api/v1/reports/")).resolves.toBeUndefined();
  });
});

it.each(["auth/session", "reports/6/canvas-source-preview", "reports/6/canvas-preview"])("limita tentativas em 502/504: %s", async path => {
 const fetcher=vi.fn().mockResolvedValue(new Response("indisponível",{status:504}));vi.stubGlobal("fetch",fetcher);
 await expect(request(`/api/v1/${path}/`,path==="auth/session"?"GET":"POST",path==="auth/session"?undefined:{})).rejects.toThrow("temporariamente indisponível");
 expect(fetcher).toHaveBeenCalledTimes(3);
});
it("limita timeout a três tentativas e anuncia em português", async () => {
 vi.useFakeTimers();
 try {
 const fetcher=vi.fn().mockImplementation((_url,opts)=>new Promise((_resolve,reject)=>opts.signal.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")))));vi.stubGlobal("fetch",fetcher);
 const result=expect(request("/api/v1/auth/session/")).rejects.toThrow("demorou demais");
 await vi.runAllTimersAsync();await result;expect(fetcher).toHaveBeenCalledTimes(3);
 }finally{vi.useRealTimers();}
});
it("não expõe metadados nem códigos em erro de validação do Canvas", async () => {
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:{fields:["Fonte confirmed: parâmetro start."]},source_id:"dados",code:"raw_backend_code"}),{status:400})));
 await expect(request("/api/v1/reports/6/canvas-validate/","POST",{})).rejects.toThrow("Fonte Agendamentos confirmados: parâmetro Data inicial.");
});
