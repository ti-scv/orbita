// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { usePreviewDialog } from "./dialogs/usePreviewDialog";
import { createDefaultLayout } from "./model";
import { previewUrlError } from "./parameters";
import { readRoute } from "../../routes";
afterEach(() => {cleanup(); window.history.replaceState({}, "", "/");});
it("a rota de prévia abre o relatório e avisa de parâmetro inexistente sem fazer requisição", async () => {
  expect(readRoute("/relatorios/6/previa").canvasId).toBe(6);
  expect(previewUrlError({start:{}}, "?unit=ame&start=2026-10-01")).toBe("");
  window.history.replaceState({}, "", "/relatorios/6/previa?unit=ame&xyz=1");
  const preview = vi.fn();
  let hook: ReturnType<typeof usePreviewDialog>;
  function Harness() { hook = usePreviewDialog({parameterSchema:{start:{type:"date"},end:{type:"date"}},outputFormat:"pdf",validateBeforeSend:()=>createDefaultLayout(),previewCanvas:preview,trackDownloadUrl:()=>"blob:test",revokeDownloadUrl:()=>{}}); return <span>{hook.previewModal?.error}</span>; }
  render(<Harness/>);
  act(() => hook.openPreviewDialog());
  expect(screen.getByText(/Este parâmetro não existe neste relatório/)).toBeTruthy();
  expect(hook!.previewModal?.defaultPeriod).toMatch(/\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/);
  await act(async()=>hook.handleRunPreview({preventDefault(){}} as React.FormEvent));
  expect(preview).not.toHaveBeenCalled();
});
