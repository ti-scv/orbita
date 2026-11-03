from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("core", "0008_report_whatsapp_permission")]
    operations = [
        migrations.CreateModel(
            name="PermissionRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("permissions", models.JSONField(default=dict)),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.unit")),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("unit", "name"), name="permission_role_unit_name")]},
        ),
    ]
