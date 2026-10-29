import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Membership, Unit


@pytest.mark.django_db
@pytest.mark.parametrize("resource", ["report-connections", "report-app-connections", "report-recipients", "report-grants", "report-automations", "report-executions", "report-snapshots", "report-snapshot-runs", "report-requests", "reports/inventory", "report-snapshots/options"])
@pytest.mark.parametrize("level,expected", [("none", 403), ("read", 200)])
def test_report_reads_use_reports_permission(resource, level, expected):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions={"reports": level, "reportWhatsApp": "none"})
    client = APIClient()
    client.force_authenticate(user)
    response = client.get(f"/api/v1/{resource}/")
    assert response.status_code == expected, (resource, response.data)
    if expected == 403:
        assert "permissão" in str(response.data).lower()
