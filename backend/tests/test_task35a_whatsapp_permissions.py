from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, Unit


@pytest.mark.django_db
@pytest.mark.parametrize("permissions, expected", [
    ({"reports": "write", "reportWhatsApp": "none"}, 403),
    ({"reports": "none", "reportWhatsApp": "read"}, 200),
    ({"reports": "write"}, 403),
])
def test_whatsapp_status_is_independent_of_reports(permissions, expected):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions=permissions)
    client = APIClient()
    client.force_authenticate(user)
    with patch("operations.report_whatsapp.service", return_value={"state": "disconnected"}):
        assert client.get("/api/v1/report-whatsapp/").status_code == expected
    assert client.get("/api/v1/auth/session/").data["permissions"]["ame"]["reportWhatsApp"] == permissions.get("reportWhatsApp", "none")


@pytest.mark.django_db
@pytest.mark.parametrize("action", ["connect", "disconnect"])
@pytest.mark.parametrize("level, expected", [("none", 403), ("read", 403), ("write", 200)])
def test_whatsapp_connection_requires_write(level, expected, action):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions={"reports": "none", "reportWhatsApp": level})
    client = APIClient()
    client.force_authenticate(user)
    with patch("operations.report_whatsapp.service", return_value={"state": "connecting"}):
        response = client.post("/api/v1/report-whatsapp/", {"action": action}, format="json", HTTP_IDEMPOTENCY_KEY="conectar")
    assert response.status_code == expected


@pytest.mark.django_db(transaction=True)
def test_migration_preserves_existing_access_and_later_edits():
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    executor = MigrationExecutor(connection)
    executor.migrate([("core", "0007_unit_logo")])
    old = executor.loader.project_state([("core", "0007_unit_logo")]).apps
    user = old.get_model("auth", "User").objects.create(username="migracao")
    unit = old.get_model("core", "Unit").objects.create(slug="migracao", name="Migração")
    member = old.get_model("core", "Membership").objects.create(user_id=user.pk, unit_id=unit.pk, role="admin", permissions={"reports": "read"})
    unchanged_user = old.get_model("auth", "User").objects.create(username="migracao_inalterada")
    unchanged = old.get_model("core", "Membership").objects.create(user_id=unchanged_user.pk, unit_id=unit.pk, role="operator", permissions={"reports": "write"})
    executor = MigrationExecutor(connection)
    try:
        executor.migrate([("core", "0008_report_whatsapp_permission")])
        member.refresh_from_db()
        assert member.permissions == {"reports": "read", "reportWhatsApp": "read"}
        unchanged.refresh_from_db()
        assert unchanged.permissions["reportWhatsApp"] == "none"
        member.permissions["reportWhatsApp"] = "write"
        member.save(update_fields=["permissions"])
        MigrationExecutor(connection).migrate([("core", "0007_unit_logo")])
        member.refresh_from_db()
        assert member.permissions == {"reports": "read", "reportWhatsApp": "write"}
        unchanged.refresh_from_db()
        assert unchanged.permissions == {"reports": "write"}
    finally:
        MigrationExecutor(connection).migrate([("core", "0008_report_whatsapp_permission")])
