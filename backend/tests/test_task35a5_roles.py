from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, PermissionRole, RemoteInstance, Unit


@pytest.mark.django_db
def test_selected_role_staleness_customization_and_clear(setup):
    client = setup["client"]
    policy = {"messages": "read", "settings": "none", "reports": "read", "reportWhatsApp": "none"}
    template = PermissionRole.objects.create(unit=setup["unit"], name="Equipe", permissions=policy)
    def post(path, body):
        return client.post(path, body, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))

    response = post("/api/v1/users/", {"version": 0, "username": "equipe", "password": "Senha-teste-2026!",
                    "grants": [{"unit": "ame", "role": "viewer", "permission_role": template.pk}]})
    assert response.status_code == 200, response.data
    user_id = response.data["id"]
    grant = response.data["grants"][0]
    assert grant["permission_role"] == {"id": template.pk, "name": "Equipe"}
    assert grant["permission_role_outdated"] is False
    original = grant["permissions"]
    template.name = "Equipe nova"
    template.permissions = {**policy, "reports": "none"}
    template.save()
    result = client.get("/api/v1/users/").data["results"]
    current = next(u for u in result if u["id"] == user_id)
    grant = current["grants"][0]
    assert grant["permission_role"] == {"id": template.pk, "name": "Equipe nova"}
    assert grant["permission_role_outdated"] is True
    assert grant["permissions"] == original
    path = f"/api/v1/users/{user_id}/configure/"
    body = {"version": current["version"], "grants": [{"unit": "ame", "role": "viewer", "permissions": original}]}
    response = post(path, body)
    assert response.status_code == 200, response.data
    assert response.data["grants"][0]["permission_role_outdated"] is True
    body["version"] = response.data["version"]
    body["grants"][0]["permissions"] = {**original, "messages": "none"}
    response = post(path, body)
    assert response.status_code == 200, response.data
    assert response.data["grants"][0]["permission_role"] is None
    body["version"] = response.data["version"]
    body["grants"][0]["permission_role"] = template.pk
    response = post(path, body)
    assert response.status_code == 200, response.data
    assert response.data["grants"][0]["permissions"]["reports"] == "none"
    body["version"] = response.data["version"]
    body["grants"][0]["permission_role"] = None
    body["grants"][0]["permissions"] = response.data["grants"][0]["permissions"]
    response = post(path, body)
    assert response.status_code == 200, response.data
    assert response.data["grants"][0]["permission_role"] is None
    assert response.data["grants"][0]["permission_role_outdated"] is False


@pytest.mark.django_db
def test_role_scope_and_authorization(setup):
    other = Unit.objects.create(slug="outra", name="Outra")
    foreign = PermissionRole.objects.create(unit=other, name="Outro", permissions={})
    client = setup["client"]
    payload = {"version": 0, "username": "alvo", "password": "Senha-teste-2026!",
               "grants": [{"unit": "ame", "role": "viewer", "permission_role": foreign.pk}]}
    assert client.post("/api/v1/users/", payload, format="json").status_code == 400
    unauthorized = get_user_model().objects.create_user("sem_acesso")
    Membership.objects.create(user=unauthorized, unit=setup["unit"], role="viewer", permissions={"settings": "none"})
    client = APIClient()
    client.force_authenticate(unauthorized)
    assert client.get("/api/v1/users/").status_code == 403
    assert client.post("/api/v1/users/", payload, format="json").status_code == 403


@pytest.mark.django_db
def test_remote_grants_reject_role_and_report_individual(setup):
    from uuid import uuid4

    connection = RemoteInstance.objects.create(
        local_unit=setup["unit"], name="Remota", base_url="http://example.test",
        key_ciphertext="encrypted", remote_instance_id=uuid4(), remote_unit_slug="remota",
        remote_role="admin", remote_permissions={"reportWhatsApp": "write"},
    )
    template = PermissionRole.objects.create(
        unit=setup["unit"], name="Tipo", permissions={"messages": "read", "settings": "none", "reports": "none", "reportWhatsApp": "none"},
    )
    grant = {"unit": f"remote:{connection.pk}", "role": "viewer", "permission_role": template.pk}
    payload = {"version": 0, "username": "remoto", "password": "Senha-teste-2026!", "grants": [grant]}
    client = setup["client"]
    assert client.post("/api/v1/users/", payload, format="json").status_code == 400
    grant["permission_role"] = None
    response = client.post("/api/v1/users/", payload, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
    assert response.status_code == 200, response.data
    assert response.data["grants"][0]["permission_role"] is None
    assert response.data["grants"][0]["permission_role_outdated"] is False


@pytest.mark.django_db(transaction=True)
def test_membership_role_migration_round_trip():
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    previous = [("core", "0011_preserve_settings_access")]
    current = [("core", "0012_membership_permission_role")]
    executor = MigrationExecutor(connection)
    executor.migrate(previous)
    apps = executor.loader.project_state(previous).apps
    user = apps.get_model("auth", "User").objects.create(username="migration_35a5")
    unit = apps.get_model("core", "Unit").objects.create(slug="migration35a5", name="Migration")
    member = apps.get_model("core", "Membership").objects.create(user_id=user.pk, unit_id=unit.pk, role="viewer", permissions={"messages": "read"})
    try:
        executor = MigrationExecutor(connection)
        executor.migrate(current)
        apps = executor.loader.project_state(current).apps
        Member = apps.get_model("core", "Membership")
        Role = apps.get_model("core", "PermissionRole")
        migrated = Member.objects.get(pk=member.pk)
        assert migrated.permission_role_id is None
        role = Role.objects.create(unit_id=unit.pk, name="Teste", permissions={})
        migrated.permission_role_id = role.pk
        migrated.save()
        MigrationExecutor(connection).migrate(previous)
        executor = MigrationExecutor(connection)
        apps = executor.loader.project_state(previous).apps
        restored = apps.get_model("core", "Membership").objects.get(pk=member.pk)
        assert restored.permissions == {"messages": "read"}
        assert apps.get_model("core", "PermissionRole").objects.filter(pk=role.pk).exists()
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

@pytest.mark.django_db
def test_remote_excess_is_limited_and_reported(setup):
    connection = RemoteInstance.objects.create(
        local_unit=setup["unit"], name="AME remota", base_url="http://example.test",
        key_ciphertext="encrypted", remote_instance_id=uuid4(), remote_unit_slug="remote",
        remote_role="admin", remote_permissions={"reports": "read", "reportWhatsApp": "none"},
    )
    payload = {"version": 0, "username": "limite_remoto", "password": "Senha-teste-2026!",
               "grants": [{"unit": f"remote:{connection.pk}", "role": "admin",
                           "permissions": {"reports": "write", "reportWhatsApp": "read"}}]}
    response = setup["client"].post("/api/v1/users/", payload, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
    assert response.status_code == 200, response.data
    grant = response.data["grants"][0]
    assert grant["permissions"]["reports"] == "read"
    assert grant["permissions"]["reportWhatsApp"] == "none"
    assert response.data["limitations"] == [{"unit": "AME remota", "sections": ["Relatórios", "WhatsApp dos relatórios"]}]
