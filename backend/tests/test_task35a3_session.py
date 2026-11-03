import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Membership, Unit


@pytest.mark.django_db
def test_session_exposes_four_types_by_unit_and_superuser():
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions={"messages": "read", "settings": "none", "reports": "write", "reportWhatsApp": "none"})
    client = APIClient()
    client.force_authenticate(user)
    data = client.get("/api/v1/auth/session/").data
    assert data["permission_types"]["ame"] == {"messages": "read", "settings": "none", "reports": "write", "reportWhatsApp": "none"}
    superuser = get_user_model().objects.create_superuser("super", "super@example.com", "teste")
    client.force_authenticate(superuser)
    assert set(client.get("/api/v1/auth/session/").data["permission_types"]["ame"].values()) == {"write"}


@pytest.mark.django_db
def test_csrf_reports_authentication_without_exposing_session():
    client = APIClient()
    anonymous = client.get("/api/v1/auth/csrf/")
    assert anonymous.status_code == 200
    assert anonymous.data["authenticated"] is False
    assert anonymous.data["csrfToken"]
    assert client.get("/api/v1/auth/session/").status_code == 401
    user = get_user_model().objects.create_user("pessoa_csrf")
    client.force_authenticate(user)
    assert client.get("/api/v1/auth/csrf/").data["authenticated"] is True
