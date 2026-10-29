import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Membership, PermissionRole


@pytest.mark.django_db
@pytest.mark.parametrize("section,path", [
    ("overview", "indicators/"), ("messages", "messages/"),
    ("messages", "replies/"), ("groups", "appointment-groups/"),
    ("issues", "issues/"),
])
@pytest.mark.parametrize("via_type", [False, True])
def test_section_is_independently_enforced(setup, section, path, via_type):
    user = get_user_model().objects.create_user("section_test")
    levels = {key: "none" for key in ("overview", "messages", "groups", "issues", "settings", "reports", "reportWhatsApp")}
    levels["messages" if section != "messages" else "overview"] = "read"
    template = PermissionRole.objects.create(unit=setup["unit"], name="Tipo", permissions=levels) if via_type else None
    member = Membership.objects.create(user=user, unit=setup["unit"], role="viewer", permissions=levels, permission_role=template)
    client = APIClient()
    client.force_authenticate(user)
    assert client.get("/api/v1/" + path, {"unit": setup["unit"].slug}).status_code == 403
    levels[section] = "read"
    if template:
        template.permissions = levels
        template.save()
        from core.users import template_policy
        member.permissions = template_policy(member.role, template)
    else:
        member.permissions = levels
    member.save()
    assert client.get("/api/v1/" + path, {"unit": setup["unit"].slug}).status_code == 200
