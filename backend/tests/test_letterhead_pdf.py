import base64
import io

from pypdf import PdfReader
from reportlab.pdfgen import canvas

from operations.letterhead_pdf import apply
from operations.report_engine import render


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
