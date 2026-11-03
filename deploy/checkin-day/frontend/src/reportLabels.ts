const databaseLabels: Record<string, string> = { orbita: "Banco do Órbita" };
export function friendlyDatabaseName(database?: string | null): string {
  return database ? databaseLabels[database.toLowerCase()] || "Banco configurado" : "Destino pendente";
}
