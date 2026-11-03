import { expect, it } from "vitest";
import { createDefaultLayout, BLOCK_LABELS } from "../model";
import { findSourceUsages } from "./sourceOps";

it("descreve os componentes afetados sem expor identificadores técnicos", () => {
  const layout = createDefaultLayout();
  const block = { id: "identificador_interno", type: "table" as const, title: "", source_id: "origem", x: 0, y: 0, width: 200, height: 100 };
  layout.pages[0].blocks.push(block);
  const usages = findSourceUsages(layout, "origem");
  expect(usages).toHaveLength(1);
  expect(usages[0].blockTitle).toBe(BLOCK_LABELS[block.type]);
  expect(usages[0].blockType).toBe(BLOCK_LABELS[block.type]);
  expect(usages[0].blockTitle).not.toContain(block.id);
  expect(findSourceUsages(layout, "outra")).toEqual([]);
});
