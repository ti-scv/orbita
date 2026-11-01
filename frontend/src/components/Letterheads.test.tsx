/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import Letterheads from "./Letterheads";

vi.mock("../api", () => ({ query: (path: string) => path, request: vi.fn() }));
import { request } from "../api";
const mock = vi.mocked(request);
beforeEach(() => {
  mock.mockReset();
  mock.mockResolvedValue({ results: [], next: null });
});

test("cadastro só fecha após salvar e mostra erros", async () => {
  render(<Letterheads unit="ame" />);
  fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "AME" } });
  mock.mockRejectedValueOnce(new Error("Falha ao salvar"));
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Falha ao salvar",
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  mock
    .mockResolvedValueOnce({ id: 1 })
    .mockResolvedValueOnce({ results: [], next: null });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
