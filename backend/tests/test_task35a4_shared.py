import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, Unit


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["cases/", "contacts/", "movements/", "appointments/?group=1", "appointments/?operational_pending=true", "agenda-items/?group=1", "agenda-items/?operational_pending=true"])
@pytest.mark.parametrize("level,allowed", [("none", False), ("read", True)])
def test_shared_reads_allow_messages_permission(path, level, allowed):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    section = "groups" if "group=" in path else "issues" if "operational_pending=" in path else "messages"
    Membership.objects.create(user=user, unit=unit, role="admin", permissions={"messages": "none", "appointments": "none", "issues": "none", "groups": "none", "campaigns": "none", section: level})
    client = APIClient()
    client.force_authenticate(user)
    response = client.get("/api/v1/" + path)
    expected = (400 if "group=1" in path else 200) if allowed else 403
    assert response.status_code == expected, (path, response.data)
    if not allowed:
        assert "permissão" in str(response.data).lower()


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["cases/00000000-0000-0000-0000-000000000001/act/", "contacts/00000000-0000-0000-0000-000000000001/review/", "movements/"])
@pytest.mark.parametrize("level,allowed", [("none", False), ("read", False), ("write", True)])
def test_shared_writes_require_messages_write(path, level, allowed):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="admin", permissions={"messages": level, "appointments": "none", "issues": "none", "groups": "none", "campaigns": "none"})
    client = APIClient()
    client.force_authenticate(user)
    response = client.post("/api/v1/" + path, {}, format="json")
    if allowed:
        assert response.status_code in (400, 404), (path, response.data)
    else:
        assert response.status_code == 403, (path, response.data)
        assert "permissão" in str(response.data).lower()
