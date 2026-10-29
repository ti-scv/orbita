import json
from unittest.mock import patch

import pytest
from core.access import SECTIONS
from core.models import Membership, RemoteInstance
from operations.models import Case, SourceEvent
from test_federation import connected, federation


@pytest.mark.django_db
def test_case_endpoints_and_purpose_write_scope(setup):
    f = setup
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.permissions.update(messages="read", campaigns="read")
    member.save()
    client = f["client"]
    event = SourceEvent.objects.create(unit=f["unit"], source="test", kind="cross",
                                       external_id="cross", occurred_at=f["now"])
    case = Case.objects.create(unit=f["unit"], event=event, purpose="waitlist")
    for path in ("cases/", "cases/operators/", "cases/metrics/", "cases/export/",
                 f"cases/{case.pk}/", f"cases/{case.pk}/timeline/",
                 f"cases/{case.pk}/communications/"):
        assert client.get("/api/v1/" + path).status_code == 200
    assert client.get("/api/v1/cases/health/").status_code == 403
    assert client.post(f"/api/v1/cases/{case.pk}/act/", {}, format="json").status_code == 403
    member.permissions["messages"] = "write"
    member.save()
    assert client.post(f"/api/v1/cases/{case.pk}/act/", {"action": "note", "text": "nota", "version": 1},
                       format="json", HTTP_IDEMPOTENCY_KEY="case-test-001").status_code == 404
    member.permissions["campaigns"] = "write"
    member.save()
    assert client.post(f"/api/v1/cases/{case.pk}/act/", {}, format="json").status_code == 400
    member.permissions = {key: "none" for key in SECTIONS}
    member.save()
    for path in ("cases/", "cases/operators/", "cases/metrics/", "cases/export/",
                 f"cases/{case.pk}/", f"cases/{case.pk}/timeline/", f"cases/{case.pk}/communications/"):
        assert client.get("/api/v1/" + path).status_code == 403
    member.permissions.update(messages="read", issues="read", reports="read", settings="read")
    member.save()
    assert client.get("/api/v1/cases/health/").status_code == 200
    for section in ("messages", "issues", "reports", "settings"):
        member.permissions[section] = "none"
        member.save()
        assert client.get("/api/v1/cases/health/").status_code == 403
        member.permissions[section] = "read"


@pytest.mark.django_db
def test_key_section_limit_is_intersection(federation):
    f = federation
    event = SourceEvent.objects.create(unit=f["unit"], source="test", kind="cross",
                                       external_id="cross", occurred_at=f["now"])
    case = Case.objects.create(unit=f["unit"], event=event, purpose="waitlist")
    limit = {key: "none" for key in SECTIONS}
    limit["messages"] = "read"
    response = f["bearer"].get("/api/v1/cases/", HTTP_X_ORBITA_SECTION_LIMIT=json.dumps(limit))
    assert response.status_code == 200
    assert str(case.pk) not in {item["id"] for item in response.json()["results"]}
    assert f["bearer"].get(f"/api/v1/cases/{case.pk}/", HTTP_X_ORBITA_SECTION_LIMIT=json.dumps(limit)).status_code == 404
    assert f["bearer"].get("/api/v1/cases/", HTTP_X_ORBITA_SECTION_LIMIT="{}").status_code == 403
    limit["campaigns"] = "read"
    assert f["bearer"].get(f"/api/v1/cases/{case.pk}/", HTTP_X_ORBITA_SECTION_LIMIT=json.dumps(limit)).status_code == 200


@pytest.mark.django_db
def test_proxy_forwards_effective_limit_and_refuses_old_origin(connected):
    f = connected
    connection = RemoteInstance.objects.get()
    connection.remote_unit_slug = f["unit"].slug
    connection.save()
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.permissions["messages"] = "read"
    member.save()
    event = SourceEvent.objects.create(unit=f["unit"], source="test", kind="cross",
                                       external_id="cross", occurred_at=f["now"])
    case = Case.objects.create(unit=f["unit"], event=event, purpose="waitlist")
    calls = []

    def origin(base_url, key, path, **kwargs):
        calls.append(path)
        if path == "federation/manifest/":
            return 200, {"Content-Type": "application/json"}, b'{"cases_section_limit":true}'
        response = f["bearer"].get("/api/v1/" + path, HTTP_X_ORBITA_SECTION_LIMIT=json.dumps(kwargs["section_limit"]))
        return response.status_code, {"Content-Type": "application/json"}, response.content

    with patch("core.federation.remote_http", side_effect=origin):
        response = f["client"].get(f["proxy"] + "cases/")
    assert response.status_code == 200
    assert str(case.pk) not in {item["id"] for item in response.json()["results"]}
    assert calls == ["federation/manifest/", "cases/"]
    with patch("core.federation.remote_http", return_value=(200, {}, b'{}')) as remote:
        assert f["client"].get(f["proxy"] + "cases/").status_code == 403
        assert remote.call_count == 1
    member.permissions["messages"] = "none"
    member.save()
    with patch("core.federation.remote_http") as remote:
        assert f["client"].get(f["proxy"] + "cases/").status_code == 403
        remote.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["cases/", "cases/operators/", "cases/metrics/", "cases/export/",
    "cases/00000000-0000-0000-0000-000000000001/",
    "cases/00000000-0000-0000-0000-000000000001/timeline/",
    "cases/00000000-0000-0000-0000-000000000001/communications/"])
def test_proxy_case_reads_are_checked_before_forwarding(connected, path):
    f = connected
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.save()
    with patch("core.federation.remote_http") as remote:
        assert f["client"].get(f["proxy"] + path).status_code == 403
        remote.assert_not_called()


@pytest.mark.django_db
def test_proxy_health_and_write_check_before_forwarding(connected):
    f = connected
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = {key: "none" for key in SECTIONS}
    member.permissions["messages"] = "read"
    member.save()
    with patch("core.federation.remote_http") as remote:
        assert f["client"].get(f["proxy"] + "cases/health/").status_code == 403
        assert f["client"].post(f["proxy"] + "cases/00000000-0000-0000-0000-000000000001/act/",
                                {}, format="json", HTTP_IDEMPOTENCY_KEY="case-test-001").status_code == 403
        remote.assert_not_called()
