from django.db import migrations, models


def enable_existing_unit(apps, schema_editor):
    Unit = apps.get_model("core", "Unit")
    Unit.objects.using(schema_editor.connection.alias).filter(slug="sansaude").update(
        checkin_enabled=True, autoagenda_enabled=True
    )


class Migration(migrations.Migration):
    dependencies = [("core", "0014_instanceaccesskey_export_user_identities")]
    operations = [
        migrations.AddField(model_name="unit", name="checkin_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="unit", name="autoagenda_enabled", field=models.BooleanField(default=False)),
        migrations.RunPython(enable_existing_unit, migrations.RunPython.noop),
    ]
