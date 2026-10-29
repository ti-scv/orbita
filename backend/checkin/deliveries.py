"""Build one reviewable Meta message for a check-in cycle."""
from zoneinfo import ZoneInfo

from django.db import transaction
from messaging.models import Message, Template
from responses.models import Issue
from scheduling.connectors import normalize_phone

from .message import message_text
from .models import CheckIn


def recipient_for(record):
    if record.appointment_id:
        source = record.appointment
        raw = (source.phone_numbers or [source.phone])[0]
    else:
        raw = record.booking.conversation.phone
    return normalize_phone(raw)


@transaction.atomic
def create_message(checkin_id):
    record = CheckIn.objects.select_for_update().select_related(
        "unit", "appointment", "booking__conversation"
    ).get(pk=checkin_id)
    if record.message_id:
        return Message.objects.filter(pk=record.message_id, unit=record.unit).first()
    if record.unit.slug != "sansaude" or record.response != "pending" or not record.planned_send_at or not record.scheduled_at:
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
        purpose="checkin", snapshot={"checkin_id": record.pk},
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
