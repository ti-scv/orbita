// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import ReportCanvasPage from "../ReportCanvasPage";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("oferece nova tentativa quando o relatório não responde", async () => {
 vi.useFakeTimers();
 const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
 vi.stubGlobal("fetch", fetchMock);
 render(<ReportCanvasPage id={57} unit="scv" admin={true} />);
 await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
 expect(screen.getByText(/Não foi possível carregar o relatório/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button", {name:"Tentar novamente"}));
 expect(fetchMock).toHaveBeenCalledTimes(4);
});
