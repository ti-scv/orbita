import { describe, it, expect } from "vitest";
import ts from "typescript";
import { friendlyDatabaseName } from "./reportLabels";

describe("vocabulário visível", () => {
  it("mantém termos internos fora de textos e nomes acessíveis", () => {
    const failures: string[] = [];
    const files = import.meta.glob("./**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [name, content] of Object.entries(files)) {
        if (/\.test\./.test(name)) continue;
        const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true, name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        function visit(node: ts.Node) {
          const jsx = ts.isJsxText(node);
          if (jsx || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
            const text = (node as ts.StringLiteral).text;
            // Internal keys, module paths, class names and diagnostics are not UI copy.
            const attrNode = ts.isJsxExpression(node.parent) ? node.parent.parent : node.parent;
            const attr = ts.isJsxAttribute(attrNode) ? attrNode.name.getText(source) : "";
            const internal = ["className", "id", "htmlFor", "aria-describedby", "aria-labelledby", "data-testid"].includes(attr) || /^(?:\.\.?\/|\/)/.test(text) || text.startsWith("[Canvas]");
            const prose = jsx || ["title", "aria-label", "label", "placeholder"].includes(attr) || /\s/.test(text) || /^(Canvas|JSON|XLSX)$/.test(text);
            if (!internal && prose && (/\b(canvas|JSON|payload|schema|slug)\b/i.test(text) || (/\bXLSX\b/.test(text) && !/Excel/.test(text)))) {
              failures.push(name + ":" + (source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1) + ": " + text.trim());
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
    }
    expect(failures).toEqual([]);
  });
  it("traduz o destino centralmente sem expor nomes técnicos", () => {
    expect(friendlyDatabaseName("orbita")).toBe("Banco do Órbita");
    expect(friendlyDatabaseName("ORBITA")).toBe("Banco do Órbita");
    expect(friendlyDatabaseName("private_database")).toBe("Banco configurado");
    expect(friendlyDatabaseName(null)).toBe("Destino pendente");
  });
});
