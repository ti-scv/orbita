from django.db import migrations, models

LEVELS = {"none": 0, "read": 1, "write": 2}
SOURCES = (("Membership", "role", "permissions"), ("RemoteMembership", "role", "permissions"), ("RemoteInstance", "remote_role", "remote_permissions"))


def effective(role, values, key):
    default = "write" if role == "admin" else "read"
    if key == "users" and role != "admin":
        default = "none"
    value = values.get(key, default)
    if value not in LEVELS:
        value = default
    if value == "write" and role != "admin":
        value = "read"
    return value


def forward(apps, schema_editor):
    db = schema_editor.connection.alias
    backup = apps.get_model("core", "PermissionMigration35SettingsBackup")
    for model_name, role_field, field in SOURCES:
        for obj in apps.get_model("core", model_name).objects.using(db).iterator():
            old = dict(getattr(obj, field) or {})
            new = dict(old)
            new["settings"] = max((effective(getattr(obj, role_field), old, key) for key in ("settings", "users", "operationsAdmin")), key=LEVELS.get)
            if new != old:
                backup.objects.using(db).create(model_name=model_name, object_id=str(obj.pk), previous=old, migrated=new)
                setattr(obj, field, new)
                obj.save(using=db, update_fields=[field])


def backward(apps, schema_editor):
    db = schema_editor.connection.alias
    backup = apps.get_model("core", "PermissionMigration35SettingsBackup")
    for model_name, _, field in SOURCES:
        model = apps.get_model("core", model_name)
        for record in backup.objects.using(db).filter(model_name=model_name).iterator():
            obj = model.objects.using(db).filter(pk=record.object_id).first()
            if not obj:
                continue
            current = dict(getattr(obj, field) or {})
            if current.get("settings") == record.migrated.get("settings"):
                if "settings" in record.previous:
                    current["settings"] = record.previous["settings"]
                else:
                    current.pop("settings", None)
                setattr(obj, field, current)
                obj.save(using=db, update_fields=[field])


class Migration(migrations.Migration):
    dependencies = [("core", "0010_preserve_task35_access")]
    operations = [
        migrations.CreateModel(name="PermissionMigration35SettingsBackup", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("model_name", models.CharField(max_length=40)), ("object_id", models.CharField(max_length=40)), ("previous", models.JSONField()), ("migrated", models.JSONField())]),
        migrations.RunPython(forward, backward),
    ]
