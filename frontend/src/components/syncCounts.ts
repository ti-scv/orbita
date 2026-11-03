export function syncCounts(counts: Record<string, unknown>): string {
 return ([["new", "novo", "novos"], ["updated", "atualizado", "atualizados"], ["removed", "removido", "removidos"], ["conflicts", "conflito", "conflitos"]] as const)
  .filter(([key]) => typeof counts[key] === "number")
  .map(([key, singular, plural]) => String(counts[key]) + " " + (counts[key] === 1 ? singular : plural)).join(", ");
}
