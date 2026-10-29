import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_preserves_local_and_remote_access_and_reverses_without_overwriting_edits():
    executor = MigrationExecutor(connection)
    executor.migrate([("core", "0009_permission_roles")])
    apps = executor.loader.project_state([("core", "0009_permission_roles")]).apps
    user = apps.get_model("auth", "User").objects.create(username="migracao35a3")
    unit = apps.get_model("core", "Unit").objects.create(slug="mig35a3", name="Migração")
    member = apps.get_model("core", "Membership").objects.create(user_id=user.pk, unit_id=unit.pk, role="admin", permissions={"messages": "none", "overview": "read", "groups": "none", "issues": "none", "appointments": "none", "reports": "none", "operationsAdmin": "write", "reportWhatsApp": "none"})
    remote = apps.get_model("core", "RemoteInstance").objects.create(local_unit_id=unit.pk, name="Remota", base_url="https://example.com", key_ciphertext="teste", remote_instance_id="00000000-0000-0000-0000-000000000001", remote_unit_slug="remota", remote_role="admin", remote_permissions=member.permissions)
    grant = apps.get_model("core", "RemoteMembership").objects.create(user_id=user.pk, connection_id=remote.pk, role="admin", permissions=member.permissions)
    try:
        MigrationExecutor(connection).migrate([("core", "0010_preserve_task35_access")])
        for obj, field in ((member, "permissions"), (remote, "remote_permissions"), (grant, "permissions")):
            obj.refresh_from_db()
            value = getattr(obj, field)
            assert value["messages"] == "read"
            assert value["reports"] == "write"
            assert value["reportWhatsApp"] == "none"
        member.permissions["messages"] = "write"
        member.save(update_fields=["permissions"])
        MigrationExecutor(connection).migrate([("core", "0009_permission_roles")])
        member.refresh_from_db(); remote.refresh_from_db(); grant.refresh_from_db()
        assert member.permissions["messages"] == "write"
        assert member.permissions["reports"] == "none"
        assert remote.remote_permissions["messages"] == "none"
        assert remote.remote_permissions["reports"] == "none"
        assert grant.permissions["messages"] == "none"
        assert grant.permissions["reports"] == "none"
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
