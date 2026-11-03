from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("operations", "0030_fpo_reference_kinds"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.AddField(model_name=model, name="removed_at", field=models.DateTimeField(blank=True, null=True))
        for model in ("reportdefinition", "reportconnection", "reportapplicationconnection")
    ] + [
        migrations.AddField(model_name=model, name="removed_by", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to=settings.AUTH_USER_MODEL))
        for model in ("reportdefinition", "reportconnection", "reportapplicationconnection")
    ] + [
        migrations.AddField(model_name=model, name="removed_was_enabled", field=models.BooleanField(blank=True, null=True))
        for model in ("reportdefinition", "reportconnection", "reportapplicationconnection")
    ]
