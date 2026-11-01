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

test("lista vários timbrados e permite alternar a prévia para paisagem", async () => {
  mock.mockResolvedValueOnce({
    results: [
      {
        id: 1,
        name: "Modelo A",
        active: true,
        background: "",
        background_landscape: "",
        margins: { top: 25, bottom: 20, left: 15, right: 15 },
        fields: [],
      },
      {
        id: 2,
        name: "Modelo B",
        active: true,
        background: "",
        background_landscape: "",
        margins: { top: 25, bottom: 20, left: 15, right: 15 },
        fields: [],
      },
    ],
    next: null,
  });
  const { container } = render(<Letterheads unit="ame" />);
  expect(await screen.findByText("Modelo A")).toBeTruthy();
  expect(screen.getByText("Modelo B")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Editar Modelo A" }));
  fireEvent.change(screen.getByLabelText("Visualização"), {
    target: { value: "landscape" },
  });
  expect(
    (container.querySelector(".letterhead-preview") as HTMLElement).style
      .aspectRatio,
  ).toBe("297 / 210");
  expect(screen.queryByLabelText("Padrão da unidade")).toBeNull();
});
