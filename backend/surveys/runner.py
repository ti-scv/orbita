from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from django.utils import timezone
from core.features import unit_feature_enabled
from surveys.models import SurveyAutomation, SurveyExecution
from surveys.inspect import fetch_survey_candidates
from surveys.sender import send_meta_survey_template, build_survey_url


def is_within_schedule_window(automation: SurveyAutomation, now_dt: datetime | None = None) -> bool:
    if not automation.enabled:
        return False

    unit = automation.unit
    if not unit_feature_enabled(unit, "surveys"):
        return False

    tz_str = unit.timezone or "America/Sao_Paulo"
    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = ZoneInfo("America/Sao_Paulo")

    local_now = (now_dt or timezone.now()).astimezone(tz)

    # 1. Dia da semana
    weekdays = automation.weekdays or [0, 1, 2, 3, 4]
    if local_now.weekday() not in weekdays:
        return False

    sched_type = getattr(automation, "schedule_type", "daily_time") or "daily_time"

    if sched_type == "daily_time":
        # Horário específico do dia (ex.: às 08:00) - executa uma vez ao dia nos dias permitidos
        target_time = automation.start_time or datetime.strptime("08:00", "%H:%M").time()
        current_time = local_now.time()

        if current_time < target_time:
            return False

        # Verifica se já executou hoje (no fuso da unidade)
        if automation.last_run_at:
            last_run_date = automation.last_run_at.astimezone(tz).date()
            if last_run_date == local_now.date():
                return False

        return True
    else:
        # Intervalo contínuo (a cada X minutos entre start_time e end_time)
        current_time = local_now.time()
        if automation.start_time and current_time < automation.start_time:
            return False
        if automation.end_time and current_time > automation.end_time:
            return False

        if automation.last_run_at:
            interval_mins = max(1, automation.interval_minutes or 15)
            if (timezone.now() - automation.last_run_at).total_seconds() < (interval_mins * 60 - 5):
                return False

        return True


def run_survey_automation(automation_id, force: bool = False) -> dict:
    automation = SurveyAutomation.objects.select_related("unit", "connection").get(pk=automation_id)

    if not force and not is_within_schedule_window(automation):
        return {
            "status": "skipped",
            "reason": "Fora da janela programada ou intervalo não atingido",
            "total_candidates": 0,
            "sent": 0,
            "failed": 0,
        }

    candidates = fetch_survey_candidates(automation, limit=automation.batch_limit)
    if not candidates:
        automation.last_run_at = timezone.now()
        automation.save(update_fields=["last_run_at"])
        return {
            "status": "completed",
            "total_candidates": 0,
            "sent": 0,
            "failed": 0,
        }

    # Atendimentos já disparados anteriormente nesta automação
    cand_att_ids = [c["attendance_id"] for c in candidates if c.get("attendance_id")]
    already_sent = set(
        SurveyExecution.objects.filter(
            automation=automation,
            attendance_id__in=cand_att_ids,
            status="sent",
        ).values_list("attendance_id", flat=True)
    )

    sent_count = 0
    failed_count = 0
    skipped_count = 0

    mapping = automation.column_mapping or {}
    first_name_only = mapping.get("patient_first_name_only", True)

    for item in candidates:
        att_id = item["attendance_id"]
        if not att_id or att_id in already_sent:
            skipped_count += 1
            continue

        phone = item.get("phone", "")
        patient_name = item.get("patient_name", "")

        survey_link = build_survey_url(automation.survey_base_url, att_id)

        # Envia pelo WhatsApp Meta Cloud API
        send_res = send_meta_survey_template(
            unit=automation.unit,
            recipient_phone=phone,
            patient_name=patient_name,
            attendance_id=att_id,
            template_name=automation.template_name,
            template_language=automation.template_language,
            first_name_only=first_name_only,
            button_parameter=att_id,
        )

        if send_res.get("success"):
            SurveyExecution.objects.create(
                automation=automation,
                unit=automation.unit,
                source_record_id=item.get("record_id", ""),
                attendance_id=att_id,
                patient_name=patient_name,
                phone=phone,
                survey_url=survey_link,
                status="sent",
                payload={
                    "request": send_res.get("payload"),
                    "response": send_res.get("response"),
                    "attendance_date": item.get("attendance_date"),
                },
            )
            already_sent.add(att_id)
            sent_count += 1
        else:
            SurveyExecution.objects.create(
                automation=automation,
                unit=automation.unit,
                source_record_id=item.get("record_id", ""),
                attendance_id=att_id,
                patient_name=patient_name,
                phone=phone,
                survey_url=survey_link,
                status="failed",
                error_message=send_res.get("error", "Erro desconhecido"),
                payload={
                    "request": send_res.get("payload"),
                    "response": send_res.get("response"),
                },
            )
            failed_count += 1

    automation.last_run_at = timezone.now()
    automation.save(update_fields=["last_run_at"])

    return {
        "status": "completed",
        "total_candidates": len(candidates),
        "sent": sent_count,
        "failed": failed_count,
        "skipped": skipped_count,
    }
