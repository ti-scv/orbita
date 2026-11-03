from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("core", "0011_preserve_settings_access")]

    operations = [
        migrations.AddField(
            model_name="membership",
            name="permission_role",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="core.permissionrole"),
        ),
    ]
