import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, Unit


@pytest.mark.django_db
@pytest.mark.parametrize("resource", ["indicators", "messages", "replies", "appointment-groups", "issues"])
@pytest.mark.parametrize("level,expected", [("none", 403), ("read", 200)])
def test_message_tabs_require_messages_permission(resource, level, expected):
    unit = Unit.objects.create(slug="ame", name="AME")
    user = get_user_model().objects.create_user("pessoa")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions={"messages": level, "overview": "write", "groups": "write", "issues": "write", "appointments": "write"})
    client = APIClient()
    client.force_authenticate(user)
    assert client.get(f"/api/v1/{resource}/").status_code == expected
