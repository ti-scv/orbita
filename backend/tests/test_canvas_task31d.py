import pytest
from operations.report_canvas.formatting import display_cell

@pytest.mark.parametrize("value,column,expected", [
    ("pending", "Resposta", "Pendente"), ("open", "Atendimento", "Aberto"),
    ("5517991279767", "Telefone", "+55 (17) 99127-9767"),
    ("5517992210360", "WhatsApp", "+55 (17) 99221-0360"),
    ("5517992210360", "Código", "5517992210360"),
    (None, "Responsável", "—"), ("open", "Nome", "open"),
])
def test_semantic_values(value, column, expected):
    assert display_cell(value, column) == expected

@pytest.mark.django_db
def test_unavailable_routes_with_unit_and_pagination(setup, settings):
    from operations.models import ReportDefinition, ReportConnection
    settings.REPORT_REMOVAL_ENABLED = False
    connection = ReportConnection.objects.create(unit=setup["unit"], name="Banco", engine="sqlite")
    report = ReportDefinition.objects.create(unit=setup["unit"], code="t31d", name="Relatório", connection=connection)
    for resource, obj in [("reports", report), ("report-connections", connection)]:
        result = setup["client"].get(f"/api/v1/{resource}/{obj.pk}/dependencias/?unit=ame")
        assert result.status_code == 200
        assert result.data["remocao_disponivel"] is False
        result = setup["client"].get(f"/api/v1/{resource}/?unit=ame&removidos=1&page=1")
        assert result.status_code == 200
        assert result.data["remocao_disponivel"] is False
        assert result.data["results"] == []


def test_pdf_and_full_spreadsheet_format_semantic_columns():
    import io
    from pypdf import PdfReader
    from openpyxl import load_workbook
    from operations.report_canvas.pdf import PDFExporter
    from operations.report_canvas.xlsx import XLSXExporter
    columns = ["Telefone", "Resposta", "Atendimento", "Responsável"]
    table = {"id":"b", "type":"table", "x":10,"y":10,"width":780,"height":200,"options":{},"columns":columns,"rows":[["5517991279767","pending","open",None]]}
    doc = {"name":"QA", "page":{"width":800,"height":500,"columns":24,"background":"#ffffff"},"pages":[{"id":"p","name":"QA","blocks":[table]}],"xlsx_mode":"table"}
    text = " ".join(page.extract_text() for page in PdfReader(io.BytesIO(PDFExporter().render(doc))).pages)
    for value in ("+55 (17) 99127-9767", "Pendente", "Aberto"):
        assert value in text
    assert "pending" not in text and "open" not in text
    book = load_workbook(io.BytesIO(XLSXExporter().render(doc)))
    assert list(book.active.values)[1][:3] == ("+55 (17) 99127-9767", "Pendente", "Aberto")
