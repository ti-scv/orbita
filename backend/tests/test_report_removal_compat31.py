import pytest
from django.conf import settings
from unittest.mock import patch
from operations.models import ReportConnection, ReportDefinition

pytestmark = pytest.mark.django_db

def test_dependencies_and_removed_list_when_unavailable(setup):
    if settings.REPORT_REMOVAL_ENABLED:
        pytest.skip("requires compatibility mode")
    connection = ReportConnection.objects.create(unit=setup["unit"], name="Banco", engine="sqlite")
    ReportDefinition.objects.create(unit=setup["unit"], code="linked31", name="Vendas", connection=connection)
    client = setup["client"]
    result = client.get(f"/api/v1/report-connections/{connection.pk}/dependencias/?unit=ame")
    assert result.status_code == 200
    assert result.data["remocao_disponivel"] is False
    assert any("Vendas" in link for link in result.data["dependencias"])
    for resource in ("reports", "report-connections"):
        result = client.get(f"/api/v1/{resource}/?unit=ame&removidos=1")
        assert result.status_code == 200 and result.data["results"] == []
        assert result.data["remocao_disponivel"] is False

def test_unexpected_dependency_failure_has_reference_only(setup):
    connection = ReportConnection.objects.create(unit=setup["unit"], name="Banco", engine="sqlite")
    with patch("operations.report_removal.dependencies", side_effect=RuntimeError("secret SQL table")):
        result = setup["client"].get(f"/api/v1/report-connections/{connection.pk}/dependencias/?unit=ame")
    assert result.status_code == 500
    assert "Referência:" in result.data["detail"]
    assert "secret" not in str(result.data)
