// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DataDrawer from "./data/DataDrawer";
afterEach(cleanup);
it("ordena a gaveta por Enter e Espaço e informa a direção", () => {
 const {container}=render(<DataDrawer source={{id:"tabela",type:"inline",columns:["Paciente"],rows:[["B"],["A"]]}} preview={null} onClose={vi.fn()} />);
 const header=screen.getByRole("columnheader",{name:/Paciente/});
 const rows=()=>Array.from(container.querySelectorAll(".cv-preview-table tbody tr")).map(r=>r.children[1].textContent);
 fireEvent.keyDown(header,{key:"Enter"});expect(header.getAttribute("aria-sort")).toBe("ascending");expect(rows()).toEqual(["A","B"]);
 fireEvent.keyDown(header,{key:" "});expect(header.getAttribute("aria-sort")).toBe("descending");expect(rows()).toEqual(["B","A"]);
});
