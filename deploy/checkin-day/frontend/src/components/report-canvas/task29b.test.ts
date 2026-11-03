import { describe, expect, it } from "vitest";
import { friendlySourceName, friendlySourceError } from "./data/sourceName";
import { inferValueType } from "./data/columnTypes";
import { friendlyParameterName, friendlyParameterValue } from "./parameters";
import type { CanvasSource } from "./model";

describe("Apresentação das fontes e parâmetros", () => {
  const source = {id:"dados", type:"report", report_id:1, dataset:"dados", label:"Agendamentos confirmados › Dados", parameters:{}} as CanvasSource;
  it("remove o sufixo técnico do nome e dos erros", () => {
    expect(friendlySourceName(source)).toBe("Agendamentos confirmados");
    expect(friendlySourceError('Fonte "dados": falhou', source)).toBe('Fonte "Agendamentos confirmados": falhou');
  });
  it("apresenta parâmetros e datas em português", () => {
    expect(friendlyParameterName("tipo_envio")).toBe("Tipo de envio");
    expect(friendlyParameterValue("tipo_envio", "appointment")).toBe("Agendamento");
    expect(friendlyParameterValue("end", null)).toBe("sem limite");
    expect(inferValueType("28/09/2026")).toBe("date");
  });
});
