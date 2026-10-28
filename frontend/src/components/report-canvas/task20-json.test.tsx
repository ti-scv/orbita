// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import JsonEditorDialog from "./dialogs/JsonEditorDialog";
import { createDefaultLayout } from "./model";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("valida antes de confirmar e aplica somente no rascunho", async () => {
 const layout=createDefaultLayout(), apply=vi.fn();
 const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 const validate=vi.fn().mockResolvedValue(layout);
 render(<JsonEditorDialog layout={layout} validate={validate} onApply={apply} onUndo={() => {}} canUndo={false} onClose={() => {}} />);
 expect(screen.getByRole("textbox",{name:"JSON do canvas"})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Validar e aplicar"}));
 await waitFor(() => expect(confirm).toHaveBeenCalled());
 expect(apply).not.toHaveBeenCalled();
 confirm.mockReturnValue(true);
 fireEvent.click(screen.getByRole("button",{name:"Validar e aplicar"}));
 await waitFor(() => expect(apply).toHaveBeenCalledWith(layout));
});
it("anuncia linha e coluna da validação do backend", async () => {
 render(<JsonEditorDialog layout={createDefaultLayout()} validate={async () => {throw new Error("JSON inválido na linha 2, coluna 4");}} onApply={vi.fn()} onUndo={vi.fn()} canUndo={false} onClose={vi.fn()} />);
 fireEvent.click(screen.getByRole("button",{name:"Validar e aplicar"}));
 await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("linha 2, coluna 4"));
 expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
});
