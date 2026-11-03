import uuid
from django.db import models


def default_weekdays():
    return [0, 1, 2, 3, 4]  # Seg a Sex


def default_column_mapping():
    return {
        "id_column": "ID",
        "attendance_column": "CD_ATENDIMENTO",
        "patient_name_column": "NM_PACIENTE",
        "phone_column": "NR_CELULAR",
        "status_column": "SN_ENVIADO",
        "sent_date_column": "DT_ENVIO",
        "attendance_date_column": "DT_ALTA_MEDICA",
        "patient_first_name_only": True,
    }


class SurveyAutomation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    unit = models.ForeignKey("core.Unit", on_delete=models.PROTECT)
    name = models.CharField(max_length=150)
    connection = models.ForeignKey(
        "operations.ReportConnection",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="Conexão de banco com acesso de leitura à view/tabela.",
    )
    table_name = models.CharField(
        max_length=150,
        help_text="Nome da tabela ou view (ex.: dbasistemas.rf_tbl_msg_alta_med_san)",
    )
    column_mapping = models.JSONField(default=default_column_mapping)

    template_name = models.CharField(max_length=100, default="pesquisa_nps")
    template_language = models.CharField(max_length=15, default="pt_BR")
    survey_base_url = models.URLField(
        max_length=500,
        blank=True,
        default="https://pesqfy.santacasavotuporanga.com.br/survey/019d923b-22e0-73ea-9a90-d84097fa0fe4",
        help_text="URL base do formulário externo da pesquisa.",
    )
    button_parameter_type = models.CharField(max_length=50, default="attendance_id")

    schedule_type = models.CharField(
        max_length=20,
        choices=[
            ("daily_time", "Horário específico do dia"),
            ("interval", "Intervalo contínuo"),
        ],
        default="daily_time",
        help_text="Tipo de agendamento da cron (horário fixo ou a cada X minutos).",
    )
    discharge_period = models.CharField(
        max_length=20,
        choices=[
            ("previous_day", "Altas do dia anterior (D-1)"),
            ("same_day", "Altas do mesmo dia (D-0)"),
            ("lookback_hours", "Últimas X horas"),
        ],
        default="previous_day",
        help_text="Filtro da data de alta médica a ser considerada para o disparo.",
    )

    interval_minutes = models.PositiveIntegerField(default=15)
    weekdays = models.JSONField(default=default_weekdays)
    start_time = models.TimeField(default="08:00:00")
    end_time = models.TimeField(default="18:00:00")

    lookback_hours = models.PositiveIntegerField(
        default=48,
        help_text="Horas retroativas de alta médica/atendimento para pesquisa.",
    )
    batch_limit = models.PositiveIntegerField(
        default=500,
        help_text="Limite de envios por ciclo para evitar picos.",
    )
    enabled = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    last_run_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.unit.slug})"


class SurveyExecution(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    automation = models.ForeignKey(
        SurveyAutomation, on_delete=models.CASCADE, related_name="executions"
    )
    unit = models.ForeignKey("core.Unit", on_delete=models.PROTECT)
    source_record_id = models.CharField(max_length=100, blank=True)
    attendance_id = models.CharField(max_length=100, db_index=True)
    patient_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=40)
    survey_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("sent", "Enviado"),
            ("test", "Teste"),
            ("skipped", "Ignorado"),
            ("failed", "Falha"),
        ],
        default="sent",
        db_index=True,
    )
    error_message = models.TextField(blank=True)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["automation", "attendance_id"],
                condition=models.Q(status="sent"),
                name="unique_sent_survey_per_attendance",
            )
        ]

    def __str__(self):
        return f"{self.attendance_id} - {self.status} ({self.created_at})"
