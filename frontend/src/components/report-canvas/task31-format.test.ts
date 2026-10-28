import { expect, it } from "vitest";
import { formatTableCell } from "./data/columnTypes";
it("formata telefones brasileiros apenas em colunas de contato", () => {
  expect(formatTableCell("5517992714448", "Telefone")).toBe("+55 (17) 99271-4448");
  expect(formatTableCell("5517992714448", "Código")).toBe("5517992714448");
  expect(formatTableCell(null, "WhatsApp")).toBe("—");
});

it("traduz estados apenas nas colunas conhecidas", () => {
  for (const [raw, label] of [["pending", "Pendente"], ["open", "Aberto"], ["no_response", "Sem resposta"]]) {
    expect(formatTableCell(raw, "Resposta")).toBe(label);
  }
});
