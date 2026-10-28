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
it("orienta a editar a fonte em erros de parâmetros", () => {
  const retry = vi.fn();
  const edit = vi.fn();
  render(<DataPanel active sources={[{id: "dados", label: "Agenda", type: "report", report_id: 1}]} availableSources={[]} onCreateSource={() => {}} onEditSource={edit} onRemoveSource={() => {}} onLoadStagePreview={retry} stagePreviewStates={{dados: {status: "error", data: null, error: "Consulta invalida", loadedAt: null, httpStatus: 400, elapsedMs: 42}}} />);
  fireEvent.click(screen.getByRole("button", {expanded: false}));
  expect(screen.getByRole("alert").textContent).not.toContain("HTTP");
  expect(screen.getByRole("alert").textContent).toContain("Consulta invalida");
  expect(screen.queryByRole("button", {name: "Tentar de novo"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Editar fonte"}));
  expect(edit).toHaveBeenCalled();
});
