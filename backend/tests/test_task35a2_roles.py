import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, PermissionRole, Unit


@pytest.mark.django_db
def test_permission_roles_admin_and_scope():
    unit = Unit.objects.create(slug="ame", name="AME")
    other = Unit.objects.create(slug="outra", name="Outra")
    admin = get_user_model().objects.create_user("admin")
    operator = get_user_model().objects.create_user("operador")
    Membership.objects.create(user=admin, unit=unit, role="admin")
    Membership.objects.create(user=operator, unit=unit, role="operator", permissions={"users": "read"})
    PermissionRole.objects.create(unit=other, name="Privado", permissions={})
    client = APIClient()
    client.force_authenticate(admin)
    policy = {"messages": "write", "settings": "none", "reports": "read", "reportWhatsApp": "none"}
    response = client.post("/api/v1/permission-roles/", {"name": "Equipe", "permissions": policy}, format="json")
    assert response.status_code == 201
    role_id = response.data["id"]
    assert len(client.get("/api/v1/permission-roles/").data["results"]) == 1
    assert client.patch(f"/api/v1/permission-roles/{role_id}/", {"permissions": {**policy, "reportWhatsApp": "write"}}, format="json").status_code == 200
    assert client.post("/api/v1/permission-roles/", {"name": "Inválido", "permissions": {"reports": "write"}}, format="json").status_code == 400
    client.force_authenticate(operator)
    assert client.get("/api/v1/permission-roles/").status_code == 200
    assert client.patch(f"/api/v1/permission-roles/{role_id}/", {"name": "Outro"}, format="json").status_code == 403
    assert client.post("/api/v1/permission-roles/", {"name": "Outro", "permissions": policy}, format="json").status_code == 403


@pytest.mark.django_db
def test_role_template_is_applied_to_membership_and_session(setup):
    from uuid import uuid4

    role = PermissionRole.objects.create(
        unit=setup["unit"], name="Atendimento",
        permissions={"messages": "read", "settings": "none", "reports": "read", "reportWhatsApp": "none"},
    )
    response = setup["client"].post(
        "/api/v1/users/", {
            "version": 0, "username": "atendimento", "password": "Senha-teste-2026!",
            "grants": [{"unit": "ame", "role": "viewer", "permission_role": role.pk}],
        }, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 200, response.data
    user = get_user_model().objects.get(username="atendimento")
    setup["client"].force_authenticate(user)
    permissions = setup["client"].get("/api/v1/auth/session/").data["permissions"]["ame"]
    assert all(permissions[key] == "read" for key in ("overview", "messages", "groups", "issues", "reports"))
    assert permissions["settings"] == permissions["reportWhatsApp"] == "none"
    assert setup["client"].get("/api/v1/messages/").status_code == 200
    assert setup["client"].get("/api/v1/report-whatsapp/").status_code == 403
