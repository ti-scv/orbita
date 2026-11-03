import uuid
from django.db import migrations, models
import django.db.models.deletion
import surveys.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("core", "0016_unit_surveys_feature"),
        ("operations", "0015_report_catalog_connections"),
    ]

    operations = [
        migrations.CreateModel(
            name="SurveyAutomation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=150)),
                ("table_name", models.CharField(help_text="Nome da tabela ou view (ex.: dbasistemas.rf_tbl_msg_alta_med_san)", max_length=150)),
                ("column_mapping", models.JSONField(default=surveys.models.default_column_mapping)),
                ("template_name", models.CharField(default="pesquisa_nps", max_length=100)),
                ("template_language", models.CharField(default="pt_BR", max_length=15)),
                ("survey_base_url", models.URLField(blank=True, default="https://pesqfy.santacasavotuporanga.com.br/survey/019d923b-22e0-73ea-9a90-d84097fa0fe4", help_text="URL base do formulário externo da pesquisa.", max_length=500)),
                ("button_parameter_type", models.CharField(default="attendance_id", max_length=50)),
                ("interval_minutes", models.PositiveIntegerField(default=15)),
                ("weekdays", models.JSONField(default=surveys.models.default_weekdays)),
                ("start_time", models.TimeField(default="08:00:00")),
                ("end_time", models.TimeField(default="18:00:00")),
                ("lookback_hours", models.PositiveIntegerField(default=48, help_text="Horas retroativas de alta médica/atendimento para pesquisa.")),
                ("batch_limit", models.PositiveIntegerField(default=30, help_text="Limite de envios por ciclo para evitar picos.")),
                ("enabled", models.BooleanField(default=False)),
                ("version", models.PositiveIntegerField(default=1)),
                ("last_run_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("connection", models.ForeignKey(blank=True, help_text="Conexão de banco com acesso de leitura à view/tabela.", null=True, on_delete=django.db.models.deletion.PROTECT, to="operations.reportconnection")),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.unit")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="SurveyExecution",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("source_record_id", models.CharField(blank=True, max_length=100)),
                ("attendance_id", models.CharField(db_index=True, max_length=100)),
                ("patient_name", models.CharField(blank=True, max_length=200)),
                ("phone", models.CharField(max_length=40)),
                ("survey_url", models.URLField(blank=True, max_length=500)),
                ("status", models.CharField(choices=[("sent", "Enviado"), ("test", "Teste"), ("skipped", "Ignorado"), ("failed", "Falha")], db_index=True, default="sent", max_length=20)),
                ("error_message", models.TextField(blank=True)),
                ("payload", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("automation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="executions", to="surveys.surveyautomation")),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.unit")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="surveyexecution",
            constraint=models.UniqueConstraint(condition=models.Q(("status", "sent")), fields=("automation", "attendance_id"), name="unique_sent_survey_per_attendance"),
        ),
    ]
