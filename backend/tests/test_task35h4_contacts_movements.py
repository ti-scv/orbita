import json
from unittest.mock import patch

import pytest
from core.access import SECTIONS
from core.models import Membership, RemoteInstance
from messaging.models import AppointmentGroup
from operations.models import Case, Contact, Movement, SourceEvent
from operations.services import ensure_appointment_case
from test_federation import connected, federation


@pytest.mark.django_db
def test_group_scope_and_actions(setup):
    f = setup
    case = ensure_appointment_case(f["appointment"])
    group = AppointmentGroup.objects.create(
        unit=f["unit"], kind="consultation", appointment_date=f["now"].date(),
        rule=f["rule"], rule_version=1, scheduled_for=f["now"],
    )
    f["message"].group = group
    f["message"].save()
    contact = Contact.objects.filter(event=case.event).first()
    movement = Movement.objects.create(unit=f["unit"], case=case, kind="cancel", created_by=f["user"])
    other_event = SourceEvent.objects.create(unit=f["unit"], source="test", kind="cross",
                                             external_id="other", occurred_at=f["now"])
    other_contact = Contact.objects.create(unit=f["unit"], event=other_event, phone="5511999990002")
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.permissions["groups"] = "write"
    member.save()
    client = f["client"]
    suffix = f"?group={group.pk}"
    assert client.get("/api/v1/contacts/").status_code == 403
    assert client.get("/api/v1/movements/").status_code == 403
    assert client.get(f"/api/v1/contacts/{contact.pk}/" + suffix).status_code == 200
    assert client.get(f"/api/v1/contacts/{other_contact.pk}/" + suffix).status_code == 404
    assert client.get(f"/api/v1/movements/{movement.pk}/" + suffix).status_code == 200
    other_case = Case.objects.create(unit=f["unit"], event=other_event, purpose="appointment")
    payload = {"case": str(other_case.pk), "kind": "cancel", "requested": {}, "case_version": 1}
    assert client.post("/api/v1/movements/" + suffix, payload, format="json",
                       HTTP_IDEMPOTENCY_KEY="move-outside-001").status_code == 404
    payload["case"] = str(case.pk)
    assert client.post("/api/v1/movements/" + suffix, payload, format="json",
                       HTTP_IDEMPOTENCY_KEY="move-inside-001").status_code == 200
    assert client.post(f"/api/v1/contacts/{contact.pk}/review/" + suffix,
                       {"status": "verified", "text": "validado", "version": 1}, format="json",
                       HTTP_IDEMPOTENCY_KEY="review-group-001").status_code == 403
    member.permissions["appointments"] = "write"
    member.save()
    assert client.post(f"/api/v1/contacts/{contact.pk}/review/" + suffix,
                       {"status": "verified", "text": "validado", "version": 1}, format="json",
                       HTTP_IDEMPOTENCY_KEY="review-group-002").status_code == 200
    assert client.post(f"/api/v1/movements/{movement.pk}/confirm/" + suffix,
                       {"version": 1, "evidence": "confirmado", "final": {}}, format="json",
                       HTTP_IDEMPOTENCY_KEY="confirm-group-02").status_code == 200
    member.permissions["groups"] = "none"
    member.save()
    assert client.get(f"/api/v1/movements/{movement.pk}/" + suffix).status_code == 403
    assert client.post(f"/api/v1/movements/{movement.pk}/confirm/" + suffix, {}, format="json",
                       HTTP_IDEMPOTENCY_KEY="confirm-group-01").status_code == 403


@pytest.mark.django_db
def test_contact_effective_permission_uses_method_and_federated_ceiling(federation):
    f = federation
    event = SourceEvent.objects.create(unit=f["unit"], source="test", kind="cross",
                                       external_id="cross-contact", occurred_at=f["now"])
    contact = Contact.objects.create(unit=f["unit"], event=event, phone="5511999990002")
    limit = {key: "none" for key in SECTIONS}
    limit.update(messages="write", campaigns="read")
    headers = {"HTTP_X_ORBITA_SECTION_LIMIT": json.dumps(limit)}
    assert f["bearer"].get(f"/api/v1/contacts/{contact.pk}/", **headers).status_code == 200
    assert f["bearer"].post(f"/api/v1/contacts/{contact.pk}/review/",
        {"status": "verified", "text": "validado", "version": 1}, format="json",
        HTTP_IDEMPOTENCY_KEY="review-limit-001", **headers).status_code == 404
    limit["campaigns"] = "write"
    headers["HTTP_X_ORBITA_SECTION_LIMIT"] = json.dumps(limit)
    assert f["bearer"].post(f"/api/v1/contacts/{contact.pk}/review/",
        {"status": "verified", "text": "validado", "version": 1}, format="json",
        HTTP_IDEMPOTENCY_KEY="review-limit-002", **headers).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("resource", ["contacts/", "movements/"])
def test_proxy_ceiling_and_old_origin(connected, resource):
    f = connected
    connection = RemoteInstance.objects.get()
    connection.remote_unit_slug = f["unit"].slug
    connection.save()
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.permissions["messages"] = "read"
    member.save()
    calls = []
    def origin(base_url, key, path, **kwargs):
        calls.append(path)
        if path == "federation/manifest/":
            return 200, {}, b'{"contacts_movements_section_limit":true}'
        response = f["bearer"].get("/api/v1/" + path,
            HTTP_X_ORBITA_SECTION_LIMIT=json.dumps(kwargs["section_limit"]))
        return response.status_code, {"Content-Type": "application/json"}, response.content
    with patch("core.federation.remote_http", side_effect=origin):
        assert f["client"].get(f["proxy"] + resource).status_code == 200
    assert calls == ["federation/manifest/", resource]
    with patch("core.federation.remote_http", return_value=(200, {}, b"{}")) as remote:
        assert f["client"].get(f["proxy"] + resource).status_code == 403
        assert remote.call_count == 1
    member.permissions["messages"] = "none"
    member.save()
    with patch("core.federation.remote_http") as remote:
        assert f["client"].get(f["proxy"] + resource).status_code == 403
        remote.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("path", [
    "contacts/", "contacts/1/", "movements/", "movements/1/",
])
def test_proxy_read_denied_before_forwarding(connected, path):
    f = connected
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.save()
    with patch("core.federation.remote_http") as remote:
        assert f["client"].get(f["proxy"] + path).status_code == 403
        remote.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["contacts/1/review/", "movements/", "movements/1/confirm/"])
def test_proxy_write_denied_before_forwarding(connected, path):
    f = connected
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.permissions["messages"] = "read"
    member.save()
    with patch("core.federation.remote_http") as remote:
        assert f["client"].post(f["proxy"] + path, {}, format="json",
                                HTTP_IDEMPOTENCY_KEY="denied-write-001").status_code == 403
        remote.assert_not_called()
