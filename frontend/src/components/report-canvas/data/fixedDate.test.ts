import { describe, expect, it } from "vitest";
import { displayFixedDate, maskFixedDate, parseFixedDate } from "./fixedDate";

describe("data fixa", () => {
  it("aplica máscara e converte para ISO", () => {
    expect(maskFixedDate("2026-01-01")).toBe("01/01/2026");
    expect(maskFixedDate("01-01-2026")).toBe("01/01/2026");
    expect(maskFixedDate("29022024")).toBe("29/02/2024");
    expect(parseFixedDate("29/02/2024")).toBe("2024-02-29");
    expect(displayFixedDate("2024-02-29")).toBe("29/02/2024");
  });
  it("recusa datas incompletas e inexistentes", () => {
    for (const date of ["29/02/2023", "31/04/2024", "01/13/2024", "01/01/0000", "12/03/20"]) expect(parseFixedDate(date)).toBeNull();
  });
});
