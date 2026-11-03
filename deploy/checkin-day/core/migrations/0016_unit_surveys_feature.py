from django.db import migrations, models


def enable_existing_unit(apps, schema_editor):
    Unit = apps.get_model("core", "Unit")
    # Ativa por padrão para Sansaúde, onde a pesquisa de satisfação NPS foi homologada
    Unit.objects.using(schema_editor.connection.alias).filter(slug="sansaude").update(
        surveys_enabled=True
    )


class Migration(migrations.Migration):
    dependencies = [("core", "0015_unit_features")]
    operations = [
        migrations.AddField(
            model_name="unit",
            name="surveys_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(enable_existing_unit, migrations.RunPython.noop),
    ]
