// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PtBrDateInput from "./PtBrDateInput";
it("datas são explícitas em português e rejeitam dias inexistentes", () => {
  const change = vi.fn();
  render(<PtBrDateInput value="2026-10-28" onChange={change} aria-label="Data"/>);
  const field = screen.getByRole("textbox",{name:"Data"}) as HTMLInputElement;
  expect(field.value).toBe("28/10/2026");
  fireEvent.change(field,{target:{value:"31/02/2026"}});
  expect(change).not.toHaveBeenCalled();
  expect(field.getAttribute("aria-invalid")).toBe("true");
  fireEvent.change(field,{target:{value:"29/10/2026"}});
  expect(change).toHaveBeenCalledWith("2026-10-29");
  fireEvent.change(field,{target:{value:""}});
  expect(change).toHaveBeenCalledWith("");
});
