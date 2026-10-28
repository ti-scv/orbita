// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Icon,
  Search,
  Calendar,
  Lightbulb,
  Check,
  Plus,
  WhatsApp,
  User,
  iconDefinitions,
} from "./components/icons";
import { whatsappStatus } from "./whatsappStatus";
import type { Appointment } from "./types";

// Runtime node require without TS compiler resolution
declare const require: any;
const fs = typeof require === "function" ? require("fs") : null;
const path = typeof require === "function" ? require("path") : null;

function createTestAppointment(deliveries: string[], responses: string[] = [], outcome = ""): Appointment {
  return {
    id: 1,
    patient: "Paciente Teste",
    external_id: "EXT-1",
    scheduled_at: "2026-10-28T10:00:00Z",
    arrival_time: "09:45",
    kind: "consultation",
    procedure: "Consulta",
    professional: "Dr. Teste",
    insurance: "SUS",
    group: "G1",
    tracking: {
      id: "case-1",
      version: 1,
      outcome,
      response: "pending",
      corrections: 0,
      observations: 0,
      messages: deliveries.length,
      contacts: deliveries.map((delivery, index) => ({
        phone: String(index),
        delivery,
        response: responses[index] || "pending",
      })),
    },
  } as unknown as Appointment;
}

describe("Novo Estilo de Ícones Duotone (Traço Uniforme + Preenchimento Suave)", () => {
  it("renderiza componente central Icon e componentes individuais no viewBox 24 com traço e preenchimento duotone", () => {
    const { container: searchContainer } = render(<Search size={24} className="test-search" />);
    const svg = searchContainer.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
    expect(svg?.classList.contains("orbita-icon")).toBe(true);
    expect(svg?.classList.contains("orbita-icon-search")).toBe(true);

    const fillGroup = svg?.querySelector(".orbita-icon-fill");
    expect(fillGroup).toBeTruthy();
    expect(fillGroup?.getAttribute("fill-opacity")).toBe("0.2");
    expect(fillGroup?.getAttribute("stroke")).toBe("none");

    const strokeGroup = svg?.querySelector(".orbita-icon-stroke");
    expect(strokeGroup).toBeTruthy();
    expect(strokeGroup?.getAttribute("stroke-linecap")).toBe("round");
    expect(strokeGroup?.getAttribute("stroke-linejoin")).toBe("round");
    expect(strokeGroup?.getAttribute("fill")).toBe("none");
  });

  it("renderiza o ícone de referência (Lightbulb) com a lâmpada em traço 1.85 e preenchimento suave", () => {
    const { container } = render(<Lightbulb size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    const fillPath = svg?.querySelector(".orbita-icon-fill path");
    expect(fillPath).toBeTruthy();
    expect(fillPath?.getAttribute("d")).toContain("M15 14");
    expect(fillPath?.getAttribute("d")).toContain("Z");

    const strokePaths = svg?.querySelectorAll(".orbita-icon-stroke path");
    expect(strokePaths?.length).toBe(3); // bulb outline, base line 1, base line 2
  });

  it("permite invocar ícones dinamicamente via <Icon name=... />", () => {
    const { container } = render(<Icon name="Database" size={20} title="Banco de dados" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.querySelector("title")?.textContent).toBe("Banco de dados");
    expect(svg?.getAttribute("role")).toBe("img");
  });

  it("ícones sem título ou aria-label recebem aria-hidden='true' para acessibilidade", () => {
    const { container: decContainer } = render(<Calendar />);
    const decSvg = decContainer.querySelector("svg");
    expect(decSvg?.getAttribute("aria-hidden")).toBe("true");

    const { container: accContainer } = render(<Calendar aria-label="Calendário de coletas" />);
    const accSvg = accContainer.querySelector("svg");
    expect(accSvg?.getAttribute("aria-hidden")).toBeFalsy();
    expect(accSvg?.getAttribute("aria-label")).toBe("Calendário de coletas");
    expect(accSvg?.getAttribute("role")).toBe("img");
  });

  it("todos os ícones usam currentColor e NUNCA fixam amarelo hardcoded", () => {
    for (const [, def] of Object.entries(iconDefinitions)) {
      const defString = JSON.stringify(def).toLowerCase();
      expect(defString).not.toContain("#ffff00");
      expect(defString).not.toContain("#facc15");
      expect(defString).not.toContain("#eab308");
      expect(defString).not.toContain("#a76b0b");
      expect(defString).not.toContain("#f9e5a9");
      expect(defString).not.toContain("yellow");

      expect(def.stroke.length).toBeGreaterThan(0);
    }

    // Regra do Danilo: botão de tema (ThemeToggle / .theme-bulb-toggle) e regras de ícones não usam amarelo fixo
    const opCss = fs.readFileSync(path.resolve("./src/operations.css"), "utf8");
    const stylesCss = fs.readFileSync(path.resolve("./src/styles.css"), "utf8");
    const combined = opCss + "\n" + stylesCss;

    expect(combined).not.toContain("#a76b0b");
    expect(combined).not.toContain("#f9e5a9");

    // Verifica que o ThemeToggle utiliza variáveis semânticas do tema
    expect(opCss).toContain(".theme-bulb-toggle.is-lit");
    expect(opCss).toMatch(/\.theme-bulb-toggle\.is-lit\s*\{[^}]*--brand-cyan/);
  });

  it("ícones puramente lineares não possuem camada de preenchimento artificial", () => {
    const { container: checkContainer } = render(<Check />);
    expect(checkContainer.querySelector(".orbita-icon-fill")).toBeNull();

    const { container: plusContainer } = render(<Plus />);
    expect(plusContainer.querySelector(".orbita-icon-fill")).toBeNull();
  });
});

describe("Regra de Cores: WhatsApp e Usuário / Avatar", () => {
  it("preserva a regra oficial do status do WhatsApp (estados e textos funcionais)", () => {
    // 1. Not sent
    const notSent = whatsappStatus(createTestAppointment([]));
    expect(notSent.state).toBe("not_sent");
    expect(notSent.label).toContain("não executado");

    // 2. Sent
    const sent = whatsappStatus(createTestAppointment(["sent"]));
    expect(sent.state).toBe("sent");
    expect(sent.label).toContain("aguardando resposta");

    // 3. Confirmed
    const confirmed = whatsappStatus(createTestAppointment(["delivered"], ["confirmed"], "confirmed"));
    expect(confirmed.state).toBe("confirmed");
    expect(confirmed.label).toContain("confirmada");

    // 4. Declined
    const declined = whatsappStatus(createTestAppointment(["delivered"], ["declined"], "declined"));
    expect(declined.state).toBe("declined");
    expect(declined.label).toContain("recusada");

    // 5. Error
    const err = whatsappStatus(createTestAppointment(["failed"]));
    expect(err.state).toBe("error");
    expect(err.label).toContain("erro");
  });

  it("preserva tokens de cores exatos para status WhatsApp e Paciente nos temas claro e escuro", () => {
    const cssPath = path.resolve("./src/styles.css");
    const opCssPath = path.resolve("./src/operations.css");
    const cssContent = fs.readFileSync(cssPath, "utf8") + "\n" + fs.readFileSync(opCssPath, "utf8");

    // Cores obrigatórias da regra de status
    // sent: #15803d / dark: #4ade80
    expect(cssContent).toContain("#15803d");
    expect(cssContent).toContain("#4ade80");

    // confirmed: #2563eb / dark: #60a5fa
    expect(cssContent).toContain("#2563eb");
    expect(cssContent).toContain("#60a5fa");

    // declined: #7c3aed / dark: #c084fc
    expect(cssContent).toContain("#7c3aed");
    expect(cssContent).toContain("#c084fc");

    // error: #dc2626 / dark: #f87171
    expect(cssContent).toContain("#dc2626");
    expect(cssContent).toContain("#f87171");

    // patient-icon classes
    expect(cssContent).toContain(".patient-icon.patient-icon-status-sent");
    expect(cssContent).toContain(".patient-icon.patient-icon-status-confirmed");
    expect(cssContent).toContain(".patient-icon.patient-icon-status-declined");
    expect(cssContent).toContain(".patient-icon.patient-icon-status-error");

    // whatsapp-status classes
    expect(cssContent).toContain(".whatsapp-status-sent");
    expect(cssContent).toContain(".whatsapp-status-confirmed");
    expect(cssContent).toContain(".whatsapp-status-declined");
    expect(cssContent).toContain(".whatsapp-status-error");
  });

  it("renderiza User e WhatsApp no novo estilo duotone preservando herança de cores", () => {
    const { container: userContainer } = render(
      <span className="patient-icon patient-icon-status-confirmed" style={{ color: "#2563eb" }}>
        <User size={15} />
      </span>
    );
    const userSvg = userContainer.querySelector("svg");
    expect(userSvg).toBeTruthy();
    expect(userSvg?.querySelector(".orbita-icon-fill")).toBeTruthy();
    expect(userSvg?.querySelector(".orbita-icon-stroke")).toBeTruthy();

    const { container: waContainer } = render(
      <span className="whatsapp-status whatsapp-status-sent" style={{ color: "#15803d" }}>
        <WhatsApp size={19} />
      </span>
    );
    const waSvg = waContainer.querySelector("svg");
    expect(waSvg).toBeTruthy();
    expect(waSvg?.querySelector(".orbita-icon-fill")).toBeTruthy();
    expect(waSvg?.querySelector(".orbita-icon-stroke")).toBeTruthy();
  });
});

describe("Auditoria Estática de Ícones do Frontend", () => {
  it("nenhum componente importa bibliotecas externas concorrentes de ícones", () => {
    const srcDir = path.resolve("./src");
    const forbiddenLibraries = [
      "@hero" + "icons",
      "react-" + "icons",
      "@mui/icons" + "-material",
      "font-" + "awesome",
      "@tabler/" + "icons",
      "@fort" + "awesome",
    ];

    function checkDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (/\.(tsx?)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf8");
          for (const lib of forbiddenLibraries) {
            expect(content).not.toContain(lib);
          }
        }
      }
    }

    checkDir(srcDir);
  });

  it("nenhum ícone de interface é desenhado com <svg> manual fora do pacote central de ícones", () => {
    const srcDir = path.resolve("./src");
    // Exceções justificadas no inventário docs/icones-inventario.md:
    // - components/icons/* (a biblioteca central de ícones)
    // - LoginOrbitAnimation.tsx (animação visual/marca da tela de login)
    // - OrbitFavicon.tsx (gerador dinâmico de favicon SVG para o navegador)
    // - ReportWhatsApp.tsx (somente a malha vetorial de conexão report-channel-connected-canvas)
    const allowedSvgFiles = new Set([
      "LoginOrbitAnimation.tsx",
      "OrbitFavicon.tsx",
      "ReportWhatsApp.tsx",
    ]);

    function checkSvgs(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "icons") continue; // pacote de ícones central
          checkSvgs(fullPath);
        } else if (/\.tsx$/.test(entry.name) && !entry.name.endsWith(".test.tsx")) {
          const content = fs.readFileSync(fullPath, "utf8");
          const hasSvg = /<svg\b/i.test(content);
          if (hasSvg) {
            expect(
              allowedSvgFiles.has(entry.name),
              `Arquivo ${entry.name} possui <svg> inline de interface desenhado manualmente fora do pacote central!`
            ).toBe(true);

            // Se for ReportWhatsApp.tsx, garantir que NÃO há ícones manuais de interface (apenas o canvas de conexão)
            if (entry.name === "ReportWhatsApp.tsx") {
              expect(content).not.toContain('fill="#25D366"');
              expect(content).toContain("<WhatsApp");
            }
          }
        }
      }
    }

    checkSvgs(srcDir);
  });

  it("todos os botões contendo apenas ícone possuem aria-label e title acessíveis em português", () => {
    const srcDir = path.resolve("./src");

    function walkTsx(dir: string): string[] {
      let results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(walkTsx(full));
        } else if (/\.tsx$/.test(entry.name) && !entry.name.endsWith(".test.tsx")) {
          results.push(full);
        }
      }
      return results;
    }

    const files = walkTsx(srcDir);
    const unaccessibleButtons: Array<{ file: string; tag: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      let pos = 0;
      while ((pos = content.indexOf("<button", pos)) !== -1) {
        let tagEnd = -1;
        let inQuote: string | null = null;
        let braceDepth = 0;
        for (let i = pos + 7; i < content.length; i++) {
          const ch = content[i];
          if (inQuote) {
            if (ch === inQuote && content[i - 1] !== "\\") inQuote = null;
          } else if (ch === '"' || ch === "'" || ch === "`") {
            inQuote = ch;
          } else if (ch === "{") {
            braceDepth++;
          } else if (ch === "}") {
            braceDepth--;
          } else if (ch === ">" && braceDepth === 0) {
            tagEnd = i;
            break;
          }
        }
        if (tagEnd === -1) {
          pos += 7;
          continue;
        }

        const openTag = content.substring(pos, tagEnd + 1);
        const closePos = content.indexOf("</button>", tagEnd);
        if (closePos === -1) {
          pos = tagEnd + 1;
          continue;
        }

        const inner = content.substring(tagEnd + 1, closePos);
        pos = closePos + 9;

        const hasIcon = /<(Icon|[A-Z][a-zA-Z0-9]*|svg)\b/.test(inner);
        if (!hasIcon) continue;

        const textWithoutTags = inner.replace(/<[^>]+>/g, " ").trim();
        const staticText = textWithoutTags.replace(/\{[^}]*\}/g, " ").trim();

        const exprs = textWithoutTags.match(/\{[\s\S]*?\}/g) || [];
        let hasDynamicText = false;
        for (const expr of exprs) {
          if (
            /["'`][a-zA-ZÀ-ÿ]{2,}/.test(expr) ||
            /\b(label|title|children)\b/.test(expr)
          ) {
            hasDynamicText = true;
            break;
          }
        }

        if (staticText.length === 0 && !hasDynamicText) {
          const hasAria = /aria-label\s*=/.test(openTag);
          const hasTitle = /title\s*=/.test(openTag);
          const hasLabelledBy = /aria-labelledby\s*=/.test(openTag);

          if ((!hasAria || !hasTitle) && !hasLabelledBy) {
            unaccessibleButtons.push({
              file: path.relative(srcDir, file),
              tag: openTag.replace(/\s+/g, " "),
            });
          }
        }
      }
    }

    expect(
      unaccessibleButtons,
      `Botões com apenas ícone sem aria-label ou title: ${JSON.stringify(unaccessibleButtons, null, 2)}`
    ).toHaveLength(0);
  });
});
