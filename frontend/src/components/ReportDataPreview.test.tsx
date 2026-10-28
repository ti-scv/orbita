// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportDataPreview from "./ReportDataPreview";
it("a prévia da lista também impede estados e telefones crus", () => {
  const {container} = render(<ReportDataPreview columns={["Telefone", "Resposta", "Atendimento", "Responsável"]} rows={[["5517992210360", "pending", "open", null]]}/>);
  for (const raw of ["5517992210360", "pending", "open"]) expect(container.textContent).not.toContain(raw);
  for (const label of ["+55 (17) 99221-0360", "Pendente", "Aberto", "—"]) expect(screen.getByText(label)).toBeTruthy();
});
