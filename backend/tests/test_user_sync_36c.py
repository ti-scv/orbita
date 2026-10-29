import json
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from core.federation_network import RemoteUnavailable
from core.models import Audit, Membership, RemoteInstance, SyncedUserIdentity
from core.user_sync import sync_users


@pytest.mark.django_db
def test_sync_release_conflict_removal_and_network(setup):
    f = setup
    connection = RemoteInstance.objects.create(
        local_unit=f["unit"], name="Origem", base_url="https://example.org",
        key_ciphertext="unused", remote_instance_id=uuid4(), remote_unit_slug="remote",
        remote_unit={"name": "Origem"}, remote_role="admin")
    def snapshot(rows):
        return (200, {}, json.dumps({"instance_id": str(connection.remote_instance_id),
                                    "unit": "remote", "users": rows}).encode())
    rows = [{"id": 1, "username": "external", "first_name": "Pessoa", "email": ""},
            {"id": 2, "username": "admin", "first_name": "Colisão", "email": ""}]
    with patch("core.user_sync.decrypt_key", return_value="key"), patch("core.user_sync.remote_http", return_value=snapshot(rows)):
        first = sync_users(connection, f["user"])
        assert (first["new"], first["updated"], first["removed"], first["conflicts"]) == (2, 0, 0, 1)
        second = sync_users(connection, f["user"])
        assert (second["new"], second["updated"], second["removed"], second["conflicts"]) == (0, 0, 0, 1)
    person = SyncedUserIdentity.objects.get(connection=connection, remote_user_id="1")
    conflict = SyncedUserIdentity.objects.get(connection=connection, remote_user_id="2")
    assert conflict.state == "conflict" and conflict.user_id is None
    assert person.state == "pending" and not person.user.is_active and not person.user.has_usable_password()
    assert not Membership.objects.filter(user=person.user).exists()
    base = "/api/v1/users/"
    f["client"].force_authenticate(person.user)
    assert f["client"].get(base + "synced/?unit=ame").status_code == 403
    f["client"].force_authenticate(f["user"])
    defer = f["client"].post(base + str(conflict.pk) + "/resolve-sync-conflict/?unit=ame",
                              {"decision": "pending"}, format="json")
    assert defer.status_code == 200
    conflict.refresh_from_db()
    assert conflict.state == "conflict" and conflict.user_id is None
    assert Audit.objects.filter(action="user_sync.conflict_deferred").exists()
    resolve = f["client"].post(base + str(conflict.pk) + "/resolve-sync-conflict/?unit=ame",
                               {"username": "distinct"}, format="json")
    assert resolve.status_code == 200
    release = f["client"].post(base + str(person.pk) + "/release-synced/?unit=ame",
        {"version": 1, "full_name": "Pessoa", "active": True,
         "password": "Different-test-password-2026!",
         "grants": [{"unit": "ame", "role": "viewer", "permissions": {"appointments": "read"}}]},
        format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
    assert release.status_code == 200, release.data
    with patch("core.user_sync.decrypt_key", return_value="key"), patch("core.user_sync.remote_http", return_value=snapshot(rows)):
        assert sync_users(connection)["ok"]
    person.refresh_from_db()
    person.user.refresh_from_db()
    assert person.state == "released" and person.user.is_active
    assert Membership.objects.filter(user=person.user).exists()
    with patch("core.user_sync.decrypt_key", return_value="key"), patch("core.user_sync.remote_http", side_effect=RemoteUnavailable("connection_failed")):
        assert not sync_users(connection)["ok"]
    person.user.refresh_from_db()
    assert person.user.is_active
    with patch("core.user_sync.decrypt_key", return_value="key"), patch("core.user_sync.remote_http", return_value=snapshot(rows[1:])):
        assert sync_users(connection)["removed"] == 1
        assert sync_users(connection)["removed"] == 0
    person.refresh_from_db()
    person.user.refresh_from_db()
    assert person.removed_at_origin and not person.user.is_active
    assert Audit.objects.filter(action="user_sync.released").exists()
    assert Audit.objects.filter(action="user_sync.conflict_resolved").exists()
    assert Audit.objects.filter(action="user_sync.failed").exists()
