"""Build one reviewable Meta message for a check-in cycle."""

from core.features import unit_feature_enabled
from zoneinfo import ZoneInfo

from django.db import transaction
from django.core.exceptions import ValidationError
from messaging.models import Message, Template
from responses.models import Issue
from scheduling.connectors import normalize_phone

from .message import message_text
from .models import CheckIn


def configuration_snapshot(config):
    return {"timezone": config.timezone, "weekdays": config.weekdays, "holidays": config.holidays,
        "business_start": config.business_start.isoformat(), "business_end": config.business_end.isoformat(),
        "lead_value": config.lead_value, "lead_unit": config.lead_unit}


def recipient_for(record):
    if record.appointment_id:
        source = record.appointment
        raw = (source.phone_numbers or [source.phone])[0]
    else:
        raw = record.booking.conversation.phone
    return normalize_phone(raw)


@transaction.atomic
def create_message(checkin_id):
    record = CheckIn.objects.select_for_update(of=("self",)).select_related(
        "unit", "appointment", "booking__conversation"
    ).get(pk=checkin_id)
    if record.message_id:
        return Message.objects.filter(pk=record.message_id, unit=record.unit).first()
    if not unit_feature_enabled(record.unit, "checkin") or record.response != "pending" or not record.planned_send_at or not record.scheduled_at:
        return None
    config = record.unit.checkin_configuration
    if not config.enabled:
        return None
    try:
        recipient = recipient_for(record)
    except (ValueError, IndexError, TypeError):
        Issue.objects.get_or_create(unit=record.unit, category="checkin_recipient_review",
            description=f"Check-in {record.pk}: contato requer revisão.", resolved_at=None)
        return None
    # A dedicated template must be supplied and approved through Meta before use.
    template = Template.objects.filter(unit=record.unit, name="checkin_agendamento",
        language="pt_BR", purpose="checkin", approved_for_test=True).first()
    if (not template or template.fields != ["date", "time"]
            or template.body != "Seu agendamento é em {{1}} às {{2}}. Responda: Confirmar ou Solicitar cancelamento."):
        Issue.objects.get_or_create(unit=record.unit, category="checkin_template_review",
            description=f"Check-in {record.pk}: template Meta requer revisão.", resolved_at=None)
        return None
    local = record.scheduled_at.astimezone(ZoneInfo(config.timezone))
    message = Message.objects.create(unit=record.unit, appointment=record.appointment,
        purpose="checkin", snapshot={"checkin_id": record.pk, "checkin_config": configuration_snapshot(config)},
        notification_key=f"checkin:{record.pk}", rule_version=0,
        appointment_revision=record.source_revision, template=template,
        template_name=template.name, template_language=template.language,
        parameters=[local.strftime("%d/%m/%Y"), local.strftime("%H:%M")],
        body=message_text(record.scheduled_at, config.timezone), recipient=recipient,
        scheduled_for=record.planned_send_at, expires_at=record.response_deadline,
        state=Message.State.PREVIEW)
    record.message_id = str(message.pk)
    record.save(update_fields=["message_id", "updated_at"])
    return message


def dispatch_error(message, now):
    """Fail closed if the source, contact, configuration or window changed."""
    from django.conf import settings
    from operations.models import Contact
    from scheduling.models import PatientPhone
    from .sources import source_snapshot

    if not settings.CHECKIN_SCHEDULER_ENABLED or not unit_feature_enabled(message.unit, "checkin"):
        return "checkin_disabled"
    record = CheckIn.objects.filter(unit=message.unit, message_id=str(message.pk)).select_related(
        "appointment", "booking__conversation", "unit__checkin_configuration"
    ).first()
    if not record or record.response != "pending":
        return "checkin_changed"
    from .models import Configuration
    config = Configuration.objects.filter(unit=record.unit).first()
    if not config:
        return "checkin_disabled"
    if (not config.enabled or config.booking_enabled == config.appointment_enabled or config.channel != "meta"
            or message.snapshot.get("checkin_config") != configuration_snapshot(config)):
        return "checkin_disabled"
    source = record.appointment if record.appointment_id else record.booking
    if record.appointment_id:
        if not config.appointment_enabled or source.status != "scheduled" or source.data_issue:
            return "checkin_source_changed"
    elif not config.booking_enabled or source.state != "confirmed":
        return "checkin_source_changed"
    snapshot = source_snapshot(source, record.unit, config.timezone)
    if snapshot["source_revision"] != record.source_revision or snapshot["scheduled_at"] != record.scheduled_at:
        return "checkin_source_changed"
    try:
        if recipient_for(record) != message.recipient:
            return "checkin_recipient_changed"
        config.clean()
        local = now.astimezone(ZoneInfo(config.timezone))
    except (ValueError, TypeError, IndexError, ValidationError):
        # Invalid configuration or contact must never result in an attempted send.
        return "checkin_invalid_configuration"
    if local.weekday() not in config.weekdays or local.date().isoformat() in config.holidays or not (config.business_start <= local.time().replace(tzinfo=None) < config.business_end):
        return "checkin_outside_window"
    if not record.planned_send_at or not record.response_deadline or now < record.planned_send_at or now >= record.response_deadline or message.scheduled_for < record.planned_send_at or message.expires_at != record.response_deadline:
        return "checkin_schedule_changed"
    local_scheduled = record.scheduled_at.astimezone(ZoneInfo(config.timezone))
    if (message.template.unit_id != record.unit_id or not message.template.approved_for_test
            or message.template.name != "checkin_agendamento" or message.template.purpose != "checkin"
            or message.template.fields != ["date", "time"]
            or message.template.body != "Seu agendamento é em {{1}} às {{2}}. Responda: Confirmar ou Solicitar cancelamento."
            or message.template_name != message.template.name or message.template_language != message.template.language
            or message.parameters != [local_scheduled.strftime("%d/%m/%Y"), local_scheduled.strftime("%H:%M")]
            or message.body != message_text(record.scheduled_at, config.timezone)):
        return "checkin_template_changed"
    if Contact.objects.filter(unit=record.unit, phone=message.recipient, opted_out=True).exists():
        return "contact_opted_out"
    if record.appointment_id and record.appointment.patient_record_id and PatientPhone.objects.filter(patient_id=record.appointment.patient_record_id, phone=message.recipient, opted_out=True).exists():
        return "contact_opted_out"
    return ""


def record_acceptance(message, now):
    """Record a confirmed provider acceptance and never infer success on failure."""
    from .services import transition
    record = CheckIn.objects.select_for_update().filter(unit=message.unit, message_id=str(message.pk)).first()
    if not record or record.response != "pending" or dispatch_error(message, now):
        Issue.objects.get_or_create(unit=message.unit, message=message, category="checkin_acceptance_review", resolved_at=None, defaults={"description": "Aceite requer revisão da equipe."})
        return
    record.provider_message_id = message.provider_id
    record.save(update_fields=["provider_message_id", "updated_at"])
    try:
        transition(unit=record.unit, checkin_id=record.pk, version=record.version,
            idempotency_key="provider_acceptance", origin="automatic", response="sent", occurred_at=now)
    except ValidationError:
        Issue.objects.get_or_create(unit=message.unit, message=message, category="checkin_acceptance_review", resolved_at=None, defaults={"description": "Aceite requer revisão da equipe."})
