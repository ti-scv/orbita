import { describe, expect, it } from "vitest";
import { friendlySourceError, friendlySourceName } from "./sourceName";
import type { CanvasSource, CatalogSqlSource } from "../model";

describe("nome amigável da fonte", () => {
  it("apresenta relatório e conjunto e traduz a mensagem do servidor", () => {
    const source = {id:"dados", type:"report", report_id:1, dataset:"dados"} as CanvasSource;
    const catalog = {id:1, name:"Acompanhamentos e contatos", datasets:[{id:"dados", name:"Dados"}]} as CatalogSqlSource;
    expect(friendlySourceName(source, catalog)).toBe("Acompanhamentos e contatos › Dados");
    expect(friendlySourceError('Fonte "dados": erro.', source, catalog)).toBe('Fonte "Acompanhamentos e contatos › Dados": erro.');
  });
});
