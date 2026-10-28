// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { request } from "../../api";
import DataPanel from "./data/DataPanel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("preserva o codigo HTTP na falha da API", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 400, ok: false, json: async () => ({detail: "Consulta invalida"}) }));
  await expect(request("/api/v1/exemplo/")).rejects.toMatchObject({message: "Consulta invalida", status: 400});
});
it("apresenta detalhes da previa e permite tentar novamente", () => {
  const retry = vi.fn();
  render(<DataPanel active sources={[{id: "dados", label: "Agenda", type: "report", report_id: 1}]} availableSources={[]} onCreateSource={() => {}} onEditSource={() => {}} onRemoveSource={() => {}} onLoadStagePreview={retry} stagePreviewStates={{dados: {status: "error", data: null, error: "Consulta invalida", loadedAt: null, httpStatus: 400, elapsedMs: 42}}} />);
  fireEvent.click(screen.getByRole("button", {expanded: false}));
  expect(screen.getByRole("alert").textContent).toContain("HTTP 400");
  expect(screen.getByRole("alert").textContent).toContain("42 ms");
  expect(screen.getByRole("alert").textContent).toContain("Consulta invalida");
  expect(screen.getByRole("button", {name: "Copiar detalhes"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Tentar de novo"}));
  expect(retry).toHaveBeenCalledWith("dados");
});
