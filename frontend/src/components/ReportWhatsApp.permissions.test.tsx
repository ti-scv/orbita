// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ReportWhatsApp from "./ReportWhatsApp";
vi.mock("../api", () => ({query: () => "/report-whatsapp", request: vi.fn(async () => ({configuration:{greeting:"Olá", sends_enabled:false, manual_enabled:false, automatic_enabled:false}, global_sends_enabled:false, status:{state:"disconnected", logs:[]}}))}));
afterEach(cleanup);
describe("WhatsApp de relatórios", () => {
  it("mostra estado sem oferecer alterações para leitura", async () => {
    render(<ReportWhatsApp unit="ame"/>);
    expect(await screen.findByText("Desconectado")).toBeTruthy();
    expect(screen.queryByRole("button", {name:/Conectar/})).toBeNull();
    expect(screen.queryByRole("button", {name:/Configurar/})).toBeNull();
  });
  it("permite conexão com escrita sem liberar configuração administrativa", async () => {
    render(<ReportWhatsApp unit="ame" editable/>);
    expect(await screen.findByRole("button", {name:/Conectar/})).toBeTruthy();
    expect(screen.queryByRole("button", {name:/Configurar/})).toBeNull();
  });
  it("mostra configuração quando autorizada", async () => {
    render(<ReportWhatsApp unit="ame" editable configurable/>);
    expect(await screen.findByRole("button", {name:/Configurar/})).toBeTruthy();
  });
});
