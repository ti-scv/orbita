import { fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

it("preserva zoom do navegador sobre o cabeçalho mesmo com foco anterior na prancha", () => {
  const reset = vi.fn(), zoomIn = vi.fn(), zoomOut = vi.fn();
  function Harness() {
    useKeyboardShortcuts({ onZoomReset: reset, onZoomIn: zoomIn, onZoomOut: zoomOut } as Parameters<typeof useKeyboardShortcuts>[0]);
    return <><header data-testid="header">Cabeçalho</header><div className="cv-stage" tabIndex={-1} data-testid="stage" /></>;
  }
  const view = render(<Harness />), stage = view.getByTestId("stage"), header = view.getByTestId("header");
  stage.focus();
  fireEvent.pointerMove(stage);
  for (const key of ["+", "-", "0"]) {
    expect(fireEvent.keyDown(stage, { key, ctrlKey: true })).toBe(false);
  }
  expect(reset).toHaveBeenCalledTimes(1);
  fireEvent.pointerMove(header);
  for (const key of ["+", "-", "0"]) {
    expect(fireEvent.keyDown(stage, { key, ctrlKey: true })).toBe(true);
  }
  expect(reset).toHaveBeenCalledTimes(1);
  expect(zoomIn).toHaveBeenCalledTimes(1);
  expect(zoomOut).toHaveBeenCalledTimes(1);
  view.unmount();
});
