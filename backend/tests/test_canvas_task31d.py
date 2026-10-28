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
