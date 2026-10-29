import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, Unit


@pytest.mark.django_db
@pytest.mark.parametrize("resource", ["rules", "imports", "audit", "logs", "control", "meta-configuration", "oracle-agendas", "oracle-configuration", "instance-keys", "remote-instances", "members", "units", "users", "permission-roles"])
@pytest.mark.parametrize("level,allowed", [("none", False), ("read", True)])
def test_settings_resources_require_settings(resource, level, allowed):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="admin", permissions={"settings": level, "users": "write", "operationsAdmin": "write"})
    client = APIClient()
    client.force_authenticate(user)
    response = client.get(f"/api/v1/{resource}/")
    if allowed:
        assert response.status_code == 200, (resource, response.data)
    else:
        assert response.status_code == 403, (resource, response.data)
        assert "permissão" in str(response.data).lower()


@pytest.mark.django_db
@pytest.mark.parametrize("level,expected", [("none", 403), ("read", 403), ("write", 400)])
def test_settings_write_requires_write(level, expected):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="admin", permissions={"settings": level})
    client = APIClient()
    client.force_authenticate(user)
    assert client.post("/api/v1/permission-roles/", {}, format="json").status_code == expected


@pytest.mark.django_db(transaction=True)
def test_settings_migration_preserves_and_reverses():
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    MigrationExecutor(connection).migrate([("core", "0010_preserve_task35_access")])
    apps = MigrationExecutor(connection).loader.project_state([("core", "0010_preserve_task35_access")]).apps
    user = apps.get_model("auth", "User").objects.create(username="migracao_config")
    unit = apps.get_model("core", "Unit").objects.create(slug="config", name="Config")
    member = apps.get_model("core", "Membership").objects.create(user_id=user.pk, unit_id=unit.pk, role="admin", permissions={"settings": "none", "users": "read", "operationsAdmin": "write"})
    try:
        MigrationExecutor(connection).migrate([("core", "0011_preserve_settings_access")])
        member.refresh_from_db()
        assert member.permissions["settings"] == "write"
        member.permissions["settings"] = "read"
        member.save(update_fields=["permissions"])
        MigrationExecutor(connection).migrate([("core", "0010_preserve_task35_access")])
        member.refresh_from_db()
        assert member.permissions["settings"] == "read"
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.django_db
def test_settings_controls_user_options_and_permission_role_write():
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="admin", permissions={"settings": "write", "users": "none"})
    client = APIClient()
    client.force_authenticate(user)
    assert client.get("/api/v1/users/options/").data["units"][0]["editable"] is True
    policy = {"messages": "read", "settings": "none", "reports": "read", "reportWhatsApp": "none"}
    assert client.post("/api/v1/permission-roles/", {"name": "Equipe", "permissions": policy}, format="json").status_code == 201
