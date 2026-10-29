import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Membership
from operations.models import Case, SourceEvent, Campaign

@pytest.mark.django_db
def test_pending_types_do_not_disclose_other_purposes(setup):
    unit = setup["unit"]
    user = get_user_model().objects.create_user("pending_only")
    Membership.objects.create(user=user, unit=unit, role="viewer", permissions={
        "appointments": "none", "issues": "read", "groups": "none",
    })
    client = APIClient()
    client.force_authenticate(user)
    Campaign.objects.create(unit=unit, name="Oculta", purpose="summons")
    for purpose, outcome in [("waitlist", "declined"), ("postoperative", "")]:
        event = SourceEvent.objects.create(unit=unit, source="test", kind=purpose,
            external_id=purpose, occurred_at=setup["now"])
        Case.objects.create(unit=unit, event=event, purpose=purpose, outcome=outcome)
    assert client.get("/api/v1/agenda-items/types/").status_code == 403
    response = client.get("/api/v1/agenda-items/types/?operational_pending=true")
    assert response.status_code == 200
    values = {item["value"] for item in response.json()}
    assert "cross:waitlist" in values
    assert "cross:postoperative" not in values
    assert "cross:summons" not in values
    assert client.get("/api/v1/agenda-items/filter_options/?operational_pending=true").status_code == 403
    Membership.objects.filter(user=user, unit=unit).update(permissions={"appointments": "read", "issues": "none"})
    assert client.get("/api/v1/agenda-items/filter_options/").status_code == 200

