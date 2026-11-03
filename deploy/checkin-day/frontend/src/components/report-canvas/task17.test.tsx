// @vitest-environment jsdom
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ChartPreview from "./blocks/ChartPreview";
import type { ChartPreviewProps } from "./blocks/ChartPreview";
const chartModule = vi.hoisted(() => {
  let resolve!: (value: {default: () => import("react").ReactNode}) => void;
  const promise = new Promise<{default: () => import("react").ReactNode}>(r => {resolve = r;});
  return {promise, resolve};
});
vi.mock("./blocks/ChartPreviewContent", () => chartModule.promise);
afterEach(cleanup);
it("mantém controles utilizáveis enquanto o runtime do gráfico carrega", async () => {
  const clicked = vi.fn();
  render(<Suspense fallback={<p>Editor bloqueado</p>}>
    <button onClick={clicked}>Editar bloco</button>
    <ChartPreview {...({} as ChartPreviewProps)} />
  </Suspense>);
  expect(screen.getByRole("status").textContent).toBe("Carregando gráfico…");
  screen.getByRole("button", {name: "Editar bloco"}).click();
  expect(clicked).toHaveBeenCalledOnce();
  expect(screen.queryByText("Editor bloqueado")).toBeNull();
  chartModule.resolve({default: () => <p>Gráfico disponível</p>});
  expect(await screen.findByText("Gráfico disponível")).toBeTruthy();
});
