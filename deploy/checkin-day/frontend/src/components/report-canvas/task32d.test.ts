import { describe, expect, it } from "vitest";
import { createSourceModalState } from "./data/sourceOps";
import { previewParameters } from "./hooks/useStagePreviews";

describe("criação de fontes", () => {
  it("não escolhe um relatório arbitrariamente", () => {
    const result = createSourceModalState([], [{id: 2, name: "Outro", code: "outro"}, {id: 1, name: "Primeiro", code: "primeiro"}]);
    expect(result.ok && result.state.reportId).toBe("");
  });
  it("prefere a unidade atual somente para fonte nova e quando é aceita", () => {
    const source = {id: "dados", type: "report" as const, report_id: 1};
    const schema = {unidade: {default: "ame", choices: [{value: "ame", label: "AME"}, {value: "scv", label: "SCV"}]}};
    expect(previewParameters(source, schema, {}, "scv", new Date(), true).values.unidade).toBe("scv");
    expect(previewParameters(source, schema, {}, "scv").values.unidade).toBe("ame");
    expect(previewParameters({...source, parameters: {unidade: "ame"}}, schema, {}, "scv", new Date(), true).values.unidade).toBe("ame");
  });
});
