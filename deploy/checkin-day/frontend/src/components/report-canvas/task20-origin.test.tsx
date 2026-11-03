// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ColumnOrigin, { OriginContext, highlightColumn } from "./data/ColumnOrigin";
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
it("abre origem somente leitura e copia a consulta", async () => {
 const copy=vi.fn().mockResolvedValue(undefined);
 vi.stubGlobal("navigator",{clipboard:{writeText:copy}});
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,status:200,json:async () => ({source:"Totais",column:"total",database:"PostgreSQL · Orbita",query:"SELECT total FROM dados",expression:""})}));
 render(<OriginContext.Provider value={{reportId:1,unit:"ame"}}><ColumnOrigin source={{id:"dados",type:"report",report_id:1}} column="total" type="number" /></OriginContext.Provider>);
 fireEvent.click(screen.getByRole("button",{name:"Origem da coluna total"}));
 await waitFor(() => expect(screen.getByText("PostgreSQL · Orbita")).toBeTruthy());
 expect(screen.getByRole("dialog").querySelector("mark")?.textContent).toBe("total");
 expect(screen.queryByRole("textbox")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Copiar consulta"}));
 await waitFor(() => expect(copy).toHaveBeenCalledWith("SELECT total FROM dados"));
 fireEvent.keyDown(screen.getByRole("button", {name:"Fechar janela"}),{key:"Escape"});
 expect(screen.queryByRole("dialog")).toBeNull();
});
it("escapa metacaracteres de nomes de coluna", () => {
 const {container}=render(<pre>{highlightColumn("SELECT a.b, axb", "a.b")}</pre>);
 expect(container.querySelectorAll("mark").length).toBe(1);
});
