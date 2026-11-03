// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import SourceDialog from "./data/SourceDialog";
import { editSourceModalState } from "./data/sourceOps";
import type { CanvasSource, SourceDialogState } from "./model";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("confirma a remoção do vínculo e preserva os demais valores sem salvar", () => {
  const source: CanvasSource = { id: "dados", type: "report", report_id: 6, parameters: { remover: "x", manter: null } };
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  const submit = vi.fn();
  function Harness() {
    const [state, setState] = useState<SourceDialogState | null>(editSourceModalState(source, []));
    return <><SourceDialog sourceModal={state} availableSources={[]} onChange={setState} onClose={() => setState(null)} onSubmit={submit} /><output data-testid="parametros">{state?.parametersJson}</output></>;
  }
  render(<Harness />);
  fireEvent.click(screen.getAllByRole("button", { name: /Remover par[â\?]metro/ })[0]);
  expect(JSON.parse(screen.getByTestId("parametros").textContent!)).toEqual(source.parameters);
  fireEvent.click(screen.getAllByRole("button", { name: /Remover par[â\?]metro/ })[0]);
  expect(JSON.parse(screen.getByTestId("parametros").textContent!)).toEqual({ manter: null });
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("só será gravada ao salvar"));
  expect(submit).not.toHaveBeenCalled();
});
