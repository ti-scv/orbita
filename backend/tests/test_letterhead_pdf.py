import base64
import io

from operations.letterhead_pdf import apply
from operations.report_engine import render
from pypdf import PdfReader
from reportlab.pdfgen import canvas


def test_letterhead_on_each_page_and_preserves_content():
    source = io.BytesIO()
    pdf = canvas.Canvas(source, pagesize=(595, 842))
    for text in ("Primeira", "Segunda"):
        pdf.drawString(100, 400, text)
        pdf.showPage()
    pdf.save()
    design = {"background": "", "margins": {"top": 30, "bottom": 25, "left": 20, "right": 20}, "fields": [{"type": "page", "text": "", "x": 20, "y": 15, "font_size": 10, "align": "left"}]}
    result = PdfReader(io.BytesIO(apply(source.getvalue(), design, title="Teste", unit="AME", user="Usuário", parameters={})))
    assert len(result.pages) == 2
    assert "Página 1 de 2" in result.pages[0].extract_text()
    assert "Primeira" in result.pages[0].extract_text()
    assert "Página 2 de 2" in result.pages[1].extract_text()
    assert "Segunda" in result.pages[1].extract_text()


def test_regular_pdf_still_renders_without_letterhead():
    result = PdfReader(io.BytesIO(base64.b64decode(render("Título", ["Coluna"], [["Valor"]], "pdf"))))
    assert "Valor" in result.pages[0].extract_text()


def test_background_is_embedded_and_content_is_scaled_into_margins():
    from PIL import Image

    image = io.BytesIO()
    Image.new("RGB", (100, 142), "white").save(image, format="PNG")
    source = io.BytesIO()
    pdf = canvas.Canvas(source, pagesize=(595, 842))
    pdf.drawString(100, 400, "Conteúdo")
    pdf.save()
    design = {"background": base64.b64encode(image.getvalue()).decode(), "margins": {"top": 30, "bottom": 25, "left": 20, "right": 20}, "fields": []}
    page = PdfReader(io.BytesIO(apply(source.getvalue(), design, title="Teste", unit="AME", user="", parameters={}))).pages[0]
    objects = page["/Resources"]["/XObject"].get_object()
    assert any(obj.get_object().get("/Subtype") == "/Image" for obj in objects.values())
    assert b" cm" in page.get_contents().get_data()
    assert "Conteúdo" in page.extract_text()


def test_landscape_uses_only_its_own_background():
    from PIL import Image

    image = io.BytesIO()
    Image.new("RGB", (142, 100), "white").save(image, format="PNG")
    encoded = base64.b64encode(image.getvalue()).decode()
    source = io.BytesIO()
    pdf = canvas.Canvas(source, pagesize=(842, 595))
    pdf.drawString(100, 400, "Conteúdo")
    pdf.save()
    design = {"background": encoded, "margins": {"top": 20, "bottom": 20, "left": 20, "right": 20}, "fields": []}
    plain = PdfReader(io.BytesIO(apply(source.getvalue(), design, title="", unit="", user="", parameters={}))).pages[0]
    assert "/XObject" not in plain["/Resources"]
    design["background_landscape"] = encoded
    page = PdfReader(io.BytesIO(apply(source.getvalue(), design, title="", unit="", user="", parameters={}))).pages[0]
    assert any(obj.get_object().get("/Subtype") == "/Image" for obj in page["/Resources"]["/XObject"].get_object().values())


def test_table_layout_respects_margins_without_scaling():
    margins = {"top": 35, "bottom": 30, "left": 25, "right": 25}
    original = base64.b64decode(render("Relatório", ["Coluna"], [[str(i)] for i in range(150)], "pdf", margins=margins))
    design = {"background": "", "margins": margins, "fields": []}
    pages = PdfReader(io.BytesIO(apply(original, design, title="", unit="", user="", parameters={}, already_laid_out=True))).pages
    assert len(pages) > 1
    assert all("Coluna" in page.extract_text() for page in pages)
    mm = 72 / 25.4
    for page in pages:
        assert b"1 0.0 0.0 1 0.0 0.0 cm" in page.get_contents().get_data() or b"1 0 0 1 0.0 0.0 cm" in page.get_contents().get_data()
        positions = []
        def collect_text(text, cm, tm, font, size):
            if text.strip():
                positions.append((tm[4] * cm[0] + tm[5] * cm[2] + cm[4], tm[4] * cm[1] + tm[5] * cm[3] + cm[5], size))
        page.extract_text(visitor_text=collect_text)
        assert positions
        assert all(margins["left"] * mm <= x <= float(page.mediabox.width) - margins["right"] * mm and margins["bottom"] * mm <= y <= float(page.mediabox.height) - margins["top"] * mm for x, y, _ in positions)
        assert any(size == 7 for _, _, size in positions)


def test_stock_report_can_paginate_with_letterhead_margins():
    from operations.stock_loans import COLUMNS, DATE_KEYS, render_stock_pdf

    headers = [*COLUMNS, "DS_FORNECEDOR"]
    rows = [["Entrada", "2026-01-01", "123", "Produto", "UN", 1, 1, "Local", "Fornecedor"] for _ in range(120)]
    values = {DATE_KEYS[0]: "2026-01-01", DATE_KEYS[1]: "2026-01-31"}
    margins = {"top": 35, "bottom": 30, "left": 25, "right": 25}
    content = render_stock_pdf(headers, rows, values, environment="homologacao", margins=margins)
    result = apply(content, {"background": "", "margins": margins, "fields": []}, title="", unit="", user="", parameters={}, already_laid_out=True)
    pages = PdfReader(io.BytesIO(result)).pages
    assert len(pages) > 1
    assert all("Fornecedor" in page.extract_text() for page in pages)


def test_operational_report_paginates_inside_letterhead_margins(monkeypatch):
    from types import SimpleNamespace
    from operations.reports import local_report_content

    monkeypatch.setattr("operations.reports.local_report_data", lambda *_: (
        ["Paciente", "Telefone", "Finalidade", "Data", "Resposta", "Resultado", "Atendimento", "Responsável"],
        [["Paciente fictício", "123", "Consulta", "2026-01-01", "Sim", "OK", "Aberto", "Usuário"] for _ in range(150)],
    ))
    job = SimpleNamespace(report=SimpleNamespace(source="local", handler="contacts", name="Relatório"), parameters={}, format="pdf")
    margins = {"top": 35, "bottom": 30, "left": 25, "right": 25}
    encoded, _ = local_report_content(job, margins=margins)
    pages = PdfReader(io.BytesIO(base64.b64decode(encoded))).pages
    assert len(pages) > 1
    assert all("Paciente" in page.extract_text() for page in pages)
    positions = []
    for page in pages:
        page.extract_text(visitor_text=lambda text, cm, tm, font, size: positions.append((text, tm[4] * cm[0] + tm[5] * cm[2] + cm[4], tm[4] * cm[1] + tm[5] * cm[3] + cm[5], size)) if text.strip() else None)
        assert all(margins["left"] * 72 / 25.4 <= x <= float(page.mediabox.width) - margins["right"] * 72 / 25.4 and margins["bottom"] * 72 / 25.4 <= y <= float(page.mediabox.height) - margins["top"] * 72 / 25.4 for _, x, y, _ in positions)
    assert any(size == 7 for _, _, _, size in positions)


def test_canvas_layout_uses_work_area_without_reducing_font():
    from operations.report_canvas.pdf import PDFExporter
    from pypdf import PdfReader

    block = {"id": "text", "type": "text", "title": "", "text": "Conteúdo",
             "x": 0, "y": 0, "width": 400, "height": 200,
             "options": {"font_size": 16}}
    document = {"name": "Teste", "page": {"width": 400, "height": 600, "background": "#ffffff"},
                "pages": [{"blocks": [block]}]}
    margins = {"left": 20, "right": 20, "top": 20, "bottom": 20}
    content = PDFExporter().render(document, margins=margins)
    page = PdfReader(io.BytesIO(content)).pages[0]
    seen = []
    page.extract_text(visitor_text=lambda text, cm, tm, font, size: seen.append((text, cm, tm, size)))
    text, matrix, position, size = next(item for item in seen if "Conteúdo" in item[0])
    assert size == 12
    assert matrix[4] >= 20 * 72 / 25.4 - .01
    assert matrix[5] + position[5] >= 20 * 72 / 25.4
    assert block["width"] == 400  # The stored design is not changed.
