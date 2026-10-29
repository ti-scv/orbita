import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, Unit


@pytest.mark.django_db
@pytest.mark.parametrize("resource", ["reports", "report-access", "report-schedules"])
@pytest.mark.parametrize("reports,admin,expected", [("none", "write", 403), ("read", "none", 200)])
def test_report_resources_require_reports_permission(resource, reports, admin, expected):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="admin", permissions={"reports": reports, "operationsAdmin": admin})
    client = APIClient()
    client.force_authenticate(user)
    assert client.get(f"/api/v1/{resource}/").status_code == expected


@pytest.mark.django_db
@pytest.mark.parametrize("level,expected", [("none", 403), ("read", 404)])
def test_canvas_read_uses_reports_permission_for_operator(level, expected):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions={"reports": level, "operationsAdmin": "none"})
    client = APIClient()
    client.force_authenticate(user)
    assert client.get("/api/v1/reports/999999/canvas/").status_code == expected
