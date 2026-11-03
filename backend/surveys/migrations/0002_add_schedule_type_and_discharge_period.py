from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="surveyautomation",
            name="schedule_type",
            field=models.CharField(
                choices=[
                    ("daily_time", "Horário específico do dia"),
                    ("interval", "Intervalo contínuo"),
                ],
                default="daily_time",
                help_text="Tipo de agendamento da cron (horário fixo ou a cada X minutos).",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="surveyautomation",
            name="discharge_period",
            field=models.CharField(
                choices=[
                    ("previous_day", "Altas do dia anterior (D-1)"),
                    ("same_day", "Altas do mesmo dia (D-0)"),
                    ("lookback_hours", "Últimas X horas"),
                ],
                default="previous_day",
                help_text="Filtro da data de alta médica a ser considerada para o disparo.",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="surveyautomation",
            name="batch_limit",
            field=models.PositiveIntegerField(
                default=500,
                help_text="Limite de envios por ciclo para evitar picos.",
            ),
        ),
    ]
