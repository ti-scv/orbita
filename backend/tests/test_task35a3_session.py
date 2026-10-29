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
