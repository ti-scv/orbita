// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportCanvas from "../ReportCanvas";

vi.mock("../../api", async () => {
  const { createDefaultLayout } = await import("./model");
  return { query: (path: string) => path, request: vi.fn(async () => {
    const layout = createDefaultLayout();
    layout.pages[0].blocks = [
      { id: "a", type: "text", title: "Primeiro", text: "Um", x: 10, y: 10, width: 200, height: 100, options: {} },
      { id: "b", type: "text", title: "Segundo", text: "Dois", x: 250, y: 10, width: 200, height: 100, options: {} },
    ];
    return { version: 1, layout, enabled: false, output_format: "pdf", sources: [], assets: [], monthly_goals: [] };
  }) };
});
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => { cleanup(); localStorage.clear(); });
it("remove componentes selecionados pelo menu e desfaz em uma ação", async () => {
  render(<ReportCanvas unit="ame" report={{ id: 6, name: "QA", version: 1 }} onClose={() => {}} />);
  const first = await screen.findByRole("group", { name: /Primeiro/ });
  const second = screen.getByRole("group", { name: /Segundo/ });
  fireEvent.focus(first);
  expect(first.className).toContain("is-selected");
  fireEvent(second, new MouseEvent("pointerdown", { bubbles: true, button: 0, shiftKey: true }));
  expect(first.className).toContain("is-selected");
  expect(second.className).toContain("is-selected");
  fireEvent.contextMenu(first);
  fireEvent.click(screen.getByRole("menuitem", { name: /Remover 2 componentes selecionados/ }));
  expect(screen.queryByRole("group", { name: /Primeiro/ })).toBeNull();
  expect(screen.queryByRole("group", { name: /Segundo/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
  await waitFor(() => expect(screen.getByRole("group", { name: /Primeiro/ })).toBeTruthy());
  expect(screen.getByRole("group", { name: /Segundo/ })).toBeTruthy();
});


it("Delete remove somente fora dos campos de texto e permite desfazer e refazer", async () => {
  render(<ReportCanvas unit="ame" report={{ id: 6, name: "QA", version: 1 }} onClose={() => {}} />);
  const first = await screen.findByRole("group", { name: /Primeiro/ });
  fireEvent.focus(first);
  const field = screen.getByRole("textbox", { name: "Nome do bloco" });
  fireEvent.keyDown(field, { key: "Delete" });
  expect(screen.getByRole("group", { name: /Primeiro/ })).toBeTruthy();
  fireEvent.keyDown(first, { key: "Delete" });
  expect(screen.queryByRole("group", { name: /Primeiro/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
  expect(screen.getByRole("group", { name: /Primeiro/ })).toBeTruthy();
  fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
  expect(screen.queryByRole("group", { name: /Primeiro/ })).toBeNull();
});



it("relatório ativo não permite remover com Delete nem pelo inspetor", async () => {
  render(<ReportCanvas unit="ame" report={{ id: 6, name: "QA", version: 1, enabled: true }} onClose={() => {}} />);
  const first = await screen.findByRole("group", { name: /Primeiro/ });
  fireEvent.focus(first);
  fireEvent.keyDown(first, { key: "Delete" });
  expect(screen.getByRole("group", { name: /Primeiro/ })).toBeTruthy();
  fireEvent.contextMenu(first);
  expect(screen.queryByRole("menuitem", { name: /Remover.*Primeiro/ })).toBeNull();
});
