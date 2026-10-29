"""Explicitly correlated responses to check-in messages."""
from django.core.exceptions import ValidationError
from django.utils import timezone
from responses.models import Issue, Reply

from .deliveries import recipient_for
from .models import CheckIn
from .services import transition
from .sources import source_snapshot


def apply_checkin_reply(event, unit, message):
    data = event.data
    text = (data.get("text") or "").strip().casefold()
    choice = {"confirmar": "confirmed", "solicitar cancelamento": "cancelled"}.get(text)
    record = CheckIn.objects.select_for_update().filter(unit=unit, message_id=str(message.pk)).select_related(
        "appointment", "booking__conversation", "unit__checkin_configuration"
    ).first()
    reason = ""
    if not record or not data.get("context_id") or data["context_id"] != message.provider_id or record.provider_message_id != message.provider_id:
        reason = "correlação inválida"
    elif not record.sent_at or event.occurred_at < record.sent_at:
        reason = "resposta anterior ao envio"
    elif record.events.filter(occurred_at__gt=event.occurred_at).exists():
        reason = "resposta fora de ordem"
    elif not choice:
        reason = "resposta ambígua"
    else:
        source = record.appointment if record.appointment_id else record.booking
        snap = source_snapshot(source, unit, record.unit.checkin_configuration.timezone)
        if (snap["source_revision"] != record.source_revision or snap["scheduled_at"] != record.scheduled_at
                or (record.appointment_id and source.status != "scheduled")
                or (record.booking_id and source.state != "confirmed")):
            reason = "origem alterada"
        else:
            try:
                if recipient_for(record) != message.recipient:
                    reason = "contato alterado"
            except (ValueError, TypeError, IndexError):
                reason = "contato inválido"
        if not reason and record.response not in ("sent", "no_response"):
            reason = "resposta fora de ordem ou conflitante"
    reply = Reply.objects.create(unit=unit, event=event, message=message, sender=data["sender"],
        text=data.get("text", ""), classification=choice if not reason else "review")
    if not reason:
        try:
            transition(unit=unit, checkin_id=record.pk, version=record.version,
                idempotency_key=f"reply:{event.key}", origin="automatic", response=choice,
                occurred_at=event.occurred_at)
        except ValidationError:
            reason = "transição requer revisão"
            reply.classification = "review"
            reply.save(update_fields=["classification"])
    if reason or choice == "cancelled":
        Issue.objects.create(unit=unit, message=message, reply=reply,
            category="checkin_reply_review" if reason else "checkin_cancel_request",
            description=f"Check-in {record.pk if record else '?'}: {reason or 'solicitação de cancelamento para a equipe' }.")
    event.processed = True
    event.save(update_fields=["processed"])
