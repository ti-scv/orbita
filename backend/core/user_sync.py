"""Import complete authenticated identity snapshots without importing access."""
import json
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.federation_network import RemoteUnavailable, decrypt_key, remote_http
from core.models import Audit, RemoteInstance, SyncedUserIdentity, UserAccessProfile


def sync_users(connection, actor=None):
    try:
        if not connection.enabled:
            raise RemoteUnavailable("connection_disabled")
        status, _, content = remote_http(connection.base_url, decrypt_key(connection.key_ciphertext),
                                         "federation/user-identities/", role="admin")
        if status != 200:
            raise RemoteUnavailable("identity_export_failed")
        try:
            data = json.loads(content)
            if str(UUID(data["instance_id"])) != str(connection.remote_instance_id) or data["unit"] != connection.remote_unit_slug:
                raise ValueError
            entries = data["users"]
            if not isinstance(entries, list) or len(entries) > 10000:
                raise ValueError
            parsed, seen = [], set()
            for item in entries:
                remote_id = str(item["id"])
                login, name, email = item["username"], item["first_name"], item["email"]
                if (not remote_id or len(remote_id) > 150 or remote_id in seen or
                    not isinstance(login, str) or not 1 <= len(login) <= 150 or
                    not isinstance(name, str) or len(name) > 150 or
                    not isinstance(email, str) or len(email) > 254):
                    raise ValueError
                seen.add(remote_id)
                parsed.append((remote_id, login, name, email))
        except (KeyError, TypeError, ValueError, UnicodeError, AttributeError):
            raise RemoteUnavailable("invalid_identity_export") from None
        with transaction.atomic():
            connection = RemoteInstance.objects.select_for_update().get(pk=connection.pk)
            now = timezone.now()
            for remote_id, login, name, email in parsed:
                identity = SyncedUserIdentity.objects.filter(connection=connection, remote_user_id=remote_id).first()
                if identity is None:
                    identity = SyncedUserIdentity(connection=connection, remote_user_id=remote_id)
                    if get_user_model().objects.filter(username=login).exists():
                        identity.state = SyncedUserIdentity.State.CONFLICT
                    else:
                        user = get_user_model()(username=login, first_name=name, email=email, is_active=False)
                        user.set_unusable_password()
                        user.save()
                        UserAccessProfile.objects.create(user=user, managing_unit=connection.local_unit, explicit_units=True)
                        identity.user = user
                identity.login, identity.name, identity.email = login, name, email
                identity.last_synced_at, identity.removed_at_origin = now, False
                identity.save()
            missing = SyncedUserIdentity.objects.filter(connection=connection).exclude(remote_user_id__in=seen)
            get_user_model().objects.filter(pk__in=missing.values_list("user_id", flat=True)).update(is_active=False)
            missing.update(removed_at_origin=True)
            Audit.objects.create(unit=connection.local_unit, actor=actor, action="user_sync.completed",
                                 object_id=str(connection.pk), details={"count": len(parsed)})
        return {"ok": True, "count": len(parsed)}
    except (RemoteUnavailable, ValidationError) as exc:
        code = exc.code if isinstance(exc, RemoteUnavailable) else "invalid_connection"
        Audit.objects.create(unit=connection.local_unit, actor=actor, action="user_sync.failed",
                             object_id=str(connection.pk), details={"code": code})
        return {"ok": False, "error": "Não foi possível sincronizar usuários. Tente novamente.", "code": code}
