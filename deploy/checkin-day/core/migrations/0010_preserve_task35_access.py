from django.db import migrations, models

SOURCES = (("Membership", "role", "permissions"), ("RemoteMembership", "role", "permissions"), ("RemoteInstance", "remote_role", "remote_permissions"))
LEVELS = {"none": 0, "read": 1, "write": 2}


def effective(role, values, key):
    default = "write" if role == "admin" or (role == "operator" and key not in {"operationsAdmin", "settings", "users"}) else "read"
    value = values.get(key, default)
    if value not in LEVELS:
        value = default
    if value == "write" and (role == "viewer" or (role != "admin" and key in {"operationsAdmin", "settings", "users"})):
        value = "read"
    return value


def forward(apps, schema_editor):
    db = schema_editor.connection.alias
    backup = apps.get_model("core", "PermissionMigration35TypesBackup")
    for model_name, role_field, permission_field in SOURCES:
        for obj in apps.get_model("core", model_name).objects.using(db).iterator():
            old = dict(getattr(obj, permission_field) or {})
            updated = dict(old)
            role = getattr(obj, role_field)
            for target, keys in (("messages", ("overview", "messages", "groups", "issues", "appointments")), ("reports", ("reports", "operationsAdmin"))):
                updated[target] = max((effective(role, old, key) for key in keys), key=LEVELS.get)
            if updated == old:
                continue
            backup.objects.using(db).create(model_name=model_name, object_id=str(obj.pk), previous=old, migrated=updated)
            setattr(obj, permission_field, updated)
            obj.save(using=db, update_fields=[permission_field])


def backward(apps, schema_editor):
    db = schema_editor.connection.alias
    backup = apps.get_model("core", "PermissionMigration35TypesBackup")
    for model_name, _, permission_field in SOURCES:
        model = apps.get_model("core", model_name)
        for record in backup.objects.using(db).filter(model_name=model_name).iterator():
            obj = model.objects.using(db).filter(pk=record.object_id).first()
            if not obj:
                continue
            current = dict(getattr(obj, permission_field) or {})
            for key in ("messages", "reports"):
                if current.get(key) == record.migrated.get(key):
                    if key in record.previous:
                        current[key] = record.previous[key]
                    else:
                        current.pop(key, None)
            setattr(obj, permission_field, current)
            obj.save(using=db, update_fields=[permission_field])


class Migration(migrations.Migration):
    dependencies = [("core", "0009_permission_roles")]
    operations = [
        migrations.CreateModel(name="PermissionMigration35TypesBackup", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("model_name", models.CharField(max_length=40)), ("object_id", models.CharField(max_length=40)), ("previous", models.JSONField()), ("migrated", models.JSONField())]),
        migrations.RunPython(forward, backward),
    ]
