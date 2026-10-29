// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageConfigDialog from "./library/PageConfigDialog";
import { createDefaultLayout, normalizeLayout, sanitizeLayoutForApi } from "./model";
import { applyPageConfigPatch } from "./stage/geometry";

describe("orientação da página", () => {
  it("alterna dimensões personalizadas nos dois sentidos e aplica", () => {
    const apply = vi.fn();
    render(<PageConfigDialog open pageConfig={{ width: 1000, height: 700, columns: 24, background: "#ffffff" }} onApply={apply} onClose={() => {}} />);
    const select = screen.getByLabelText("Orientação da página");
    fireEvent.change(select, { target: { value: "portrait" } });
    expect(screen.getByLabelText("Largura (px)")).toHaveProperty("value", "700");
    fireEvent.change(select, { target: { value: "landscape" } });
    fireEvent.change(select, { target: { value: "portrait" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ width: 700, height: 1000 }));
  });

  it("preserva proporções, limites e dimensões ao salvar e reabrir", () => {
    const original = createDefaultLayout();
    original.pages[0].blocks = [{ id: "b", type: "text", x: 100, y: 800, width: 600, height: 200, text: "Conteúdo", options: {} }];
    const landscape = applyPageConfigPatch(original, { width: 1123, height: 794 });
    const block = landscape.pages[0].blocks[0];
    expect(block.x + block.width).toBeLessThanOrEqual(1123);
    expect(block.y + block.height).toBeLessThanOrEqual(794);
    expect(block.y / 794).toBeCloseTo(800 / 1123, 4);
    const reopened = normalizeLayout(sanitizeLayoutForApi(landscape));
    expect(reopened.page).toEqual(landscape.page);
    const portrait = applyPageConfigPatch(reopened, { width: 794, height: 1123 });
    expect(portrait.pages[0].blocks[0].y).toBeCloseTo(800, 1);
    expect(portrait.pages[0].blocks[0].height).toBeCloseTo(200, 1);
  });
  it("reserva margem inferior ao reduzir a altura da página", () => {
    const original = createDefaultLayout();
    original.pages[0].blocks = [{ id: "b", type: "text", x: 0, y: 900, width: 700, height: 223, text: "Conteúdo", options: {} }];
    const landscape = applyPageConfigPatch(original, { width: 1123, height: 794 });
    const block = landscape.pages[0].blocks[0];
    expect(block.y + block.height).toBeLessThanOrEqual(770);
  });

});
