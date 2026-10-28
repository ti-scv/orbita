// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import KpiPreview from "./blocks/KpiPreview";
import ImagePreview from "./blocks/ImagePreview";
import ChartPreviewContent from "./blocks/ChartPreviewContent";
import type { CanvasBlock, CanvasSource, CatalogSqlSource } from "./model";

afterEach(cleanup);

describe("Tarefa 19: validação e correções de KPI, gráficos e imagem com dados reais", () => {
  const sourceReport: CanvasSource = {
    id: "dados",
    type: "report",
    report_id: 6,
    label: "Acompanhamentos e contatos",
  };
  const catalogReport: CatalogSqlSource = {
    id: 6,
    name: "Acompanhamentos e contatos",
    code: "contacts",
    columns: ["Paciente", "Data", "Atendimentos", "Valor"],
  };

  describe("Bloco KPI", () => {
    it("calcula contagem de linhas reais e formata em pt-BR", () => {
      const block: CanvasBlock = {
        id: "kpi-count",
        type: "kpi",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        title: "Total de Pacientes",
        source_id: "dados",
        options: { aggregate: "count" },
      };
      const dataset = {
        columns: ["Paciente", "Data"],
        rows: Array.from({ length: 2473 }, (_, i) => [`Paciente ${i}`, "2026-09-21"]),
      };

      render(
        <KpiPreview
          block={block}
          source={sourceReport}
          catalog={catalogReport}
          dataset={dataset}
          fontSize={28}
          primaryColor="#075b94"
          showSampleData={false}
        />,
      );

      expect(screen.getByText("Total de Pacientes")).toBeTruthy();
      expect(screen.getByText("2.473")).toBeTruthy();
      expect(screen.getByText("Contagem")).toBeTruthy();
      expect(screen.getByText("Acompanhamentos e contatos (contacts)")).toBeTruthy();
    });

    it("mostra 0 na contagem quando a fonte real retorna 0 linhas", () => {
      const block: CanvasBlock = {
        id: "kpi-zero",
        type: "kpi",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        source_id: "dados",
        options: { aggregate: "count" },
      };
      const dataset = { columns: ["Paciente", "Data"], rows: [] };

      render(
        <KpiPreview
          block={block}
          source={sourceReport}
          catalog={catalogReport}
          dataset={dataset}
          fontSize={28}
          primaryColor="#075b94"
          showSampleData={false}
        />,
      );

      expect(screen.getByText("0")).toBeTruthy();
    });

    it("soma valores numéricos com decimais pt-BR e exibe unidade", () => {
      const block: CanvasBlock = {
        id: "kpi-sum",
        type: "kpi",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        title: "Tempo Total",
        source_id: "dados",
        options: {
          aggregate: "sum",
          value_field: "Valor",
          precision: 2,
          unit: "min",
        } as any,
      };
      const dataset = {
        columns: ["Paciente", "Valor"],
        rows: [
          ["Paciente 1", "1.200,50"],
          ["Paciente 2", "46,56"],
        ],
      };

      render(
        <KpiPreview
          block={block}
          source={sourceReport}
          catalog={catalogReport}
          dataset={dataset}
          fontSize={28}
          primaryColor="#075b94"
          showSampleData={false}
        />,
      );

      expect(screen.getByText("1.247,06 min")).toBeTruthy();
    });

    it("indica a fonte e deixa claro de onde vem o dado", () => {
      const block: CanvasBlock = {
        id: "kpi-source",
        type: "kpi",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        source_id: "dados",
        options: { aggregate: "count" },
      };
      const dataset = { columns: ["A"], rows: [["1"]] };

      const { container } = render(
        <KpiPreview
          block={block}
          source={sourceReport}
          catalog={catalogReport}
          dataset={dataset}
          fontSize={28}
          primaryColor="#075b94"
          showSampleData={false}
        />,
      );

      const inner = container.querySelector(".cv-block-inner");
      expect(inner?.getAttribute("title")).toContain("Acompanhamentos e contatos (contacts)");
      expect(screen.getAllByTitle("Acompanhamentos e contatos (contacts)").length).toBeGreaterThan(0);
    });
  });

  describe("Bloco de Imagem", () => {
    const assets = [
      {
        id: "asset-1",
        filename: "logo-hospital.png",
        width: 800,
        height: 600,
      },
    ];

    it("renderiza imagem com título e tooltip acessíveis", () => {
      const block: CanvasBlock = {
        id: "img-1",
        type: "image",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        asset_id: "asset-1",
      };

      render(
        <ImagePreview
          block={block}
          assets={assets}
          assetUrls={{ "asset-1": "blob:http://localhost/logo-1" }}
        />,
      );

      const img = screen.getByRole("img") as HTMLImageElement;
      expect(img.src).toBe("blob:http://localhost/logo-1");
      expect(img.getAttribute("title")).toBe("logo-hospital.png");
      expect(img.getAttribute("alt")).toBe("logo-hospital.png");
    });

    it("recupera estado de erro quando o asset_id ou URL é atualizado", () => {
      const block: CanvasBlock = {
        id: "img-1",
        type: "image",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        asset_id: "asset-1",
      };

      const { rerender } = render(
        <ImagePreview
          block={block}
          assets={assets}
          assetUrls={{ "asset-1": "blob:http://localhost/broken" }}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(screen.getByText(/Falha ao carregar "logo-hospital.png"/)).toBeTruthy();

      // Troca por um novo asset válido: o erro deve ser limpo
      rerender(
        <ImagePreview
          block={{ ...block, asset_id: "asset-2" }}
          assets={[...assets, { id: "asset-2", filename: "novo.png", width: 400, height: 300 }]}
          assetUrls={{ "asset-2": "blob:http://localhost/novo" }}
        />,
      );

      const newImg = screen.getByRole("img") as HTMLImageElement;
      expect(newImg.src).toBe("blob:http://localhost/novo");
    });
  });

  describe("Blocos de Gráficos (Barras, Linhas, Pizza)", () => {
    it("formata datas em pt-BR e indica a fonte no gráfico de barras", () => {
      const block: CanvasBlock = {
        id: "bar-1",
        type: "bar",
        x: 0,
        y: 0,
        width: 500,
        height: 300,
        title: "Atendimentos por Dia",
        source_id: "dados",
        options: { x_field: "Data", y_fields: ["Atendimentos"] },
      };
      const dataset = {
        columns: ["Data", "Atendimentos"],
        rows: [
          ["2026-09-21T00:00:00", 120],
          ["2026-09-22T00:00:00", 150],
        ],
      };

      const { container } = render(
        <ChartPreviewContent
          block={block}
          source={sourceReport}
          catalog={catalogReport}
          dataset={dataset}
          primaryColor="#075b94"
          axisColor="#595959"
          gridColor="#d4d4d4"
          showSampleData={false}
        />,
      );

      const inner = container.querySelector(".cv-block-inner");
      expect(inner?.getAttribute("title")).toContain("Acompanhamentos e contatos (contacts)");
      expect(screen.getByText("Atendimentos por Dia")).toBeTruthy();
    });

    it("exibe aviso claro no gráfico de pizza quando valores são zero em vez de tela branca", () => {
      const block: CanvasBlock = {
        id: "pie-1",
        type: "pie",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        title: "Distribuição",
        source_id: "dados",
        options: { x_field: "Categoria", y_fields: ["Total"] },
      };
      const dataset = {
        columns: ["Categoria", "Total"],
        rows: [
          ["A", 0],
          ["B", 0],
        ],
      };

      render(
        <ChartPreviewContent
          block={block}
          source={sourceReport}
          catalog={catalogReport}
          dataset={dataset}
          primaryColor="#075b94"
          axisColor="#595959"
          gridColor="#d4d4d4"
          showSampleData={false}
        />,
      );

      expect(
        screen.getByText("Sem valores numéricos maiores que zero para exibir no gráfico de pizza."),
      ).toBeTruthy();
    });

    it("exibe mensagem clara quando a fonte não possui linhas para prévia", () => {
      const block: CanvasBlock = {
        id: "line-empty",
        type: "line",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        source_id: "dados",
        options: { x_field: "Data", y_fields: ["Total"] },
      };
      const dataset = { columns: ["Data", "Total"], rows: [] };

      render(
        <ChartPreviewContent
          block={block}
          source={sourceReport}
          catalog={catalogReport}
          dataset={dataset}
          primaryColor="#075b94"
          axisColor="#595959"
          gridColor="#d4d4d4"
          showSampleData={false}
        />,
      );

      expect(screen.getByText("Fonte sem linhas para prévia.")).toBeTruthy();
      expect(screen.getByText("Acompanhamentos e contatos (contacts)")).toBeTruthy();
    });
  });
});
