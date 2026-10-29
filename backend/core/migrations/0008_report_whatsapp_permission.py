from django.db import migrations, models

SOURCES = (("Membership", "role", "permissions"), ("RemoteMembership", "role", "permissions"), ("RemoteInstance", "remote_role", "remote_permissions"))


def forward(apps, schema_editor):
    backup = apps.get_model("core", "PermissionMigration35Backup")
    db = schema_editor.connection.alias
    for model_name, role_field, permission_field in SOURCES:
        model = apps.get_model("core", model_name)
        for obj in model.objects.using(db).iterator():
            permissions = dict(getattr(obj, permission_field) or {})
            if "reportWhatsApp" in permissions:
                continue
            role = getattr(obj, role_field)
            reports = permissions.get("reports", "write" if role in ("admin", "operator") else "read")
            value = reports if role == "admin" and reports in ("none", "read", "write") else "none"
            backup.objects.using(db).create(model_name=model_name, object_id=str(obj.pk), migrated_value=value)
            permissions["reportWhatsApp"] = value
            setattr(obj, permission_field, permissions)
            obj.save(using=db, update_fields=[permission_field])


def backward(apps, schema_editor):
    backup = apps.get_model("core", "PermissionMigration35Backup")
    db = schema_editor.connection.alias
    for model_name, _, permission_field in SOURCES:
        model = apps.get_model("core", model_name)
        for record in backup.objects.using(db).filter(model_name=model_name).iterator():
            obj = model.objects.using(db).filter(pk=record.object_id).first()
            if obj is None:
                continue
            permissions = dict(getattr(obj, permission_field) or {})
            if permissions.get("reportWhatsApp") == record.migrated_value:
                permissions.pop("reportWhatsApp", None)
                setattr(obj, permission_field, permissions)
                obj.save(using=db, update_fields=[permission_field])


class Migration(migrations.Migration):
    dependencies = [("core", "0007_unit_logo")]
    operations = [
        migrations.CreateModel(name="PermissionMigration35Backup", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("model_name", models.CharField(max_length=40)), ("object_id", models.CharField(max_length=40)), ("migrated_value", models.CharField(max_length=5))], options={"constraints": [models.UniqueConstraint(fields=("model_name", "object_id"), name="permission35_backup_unique")]}),
        migrations.RunPython(forward, backward),
    ]
