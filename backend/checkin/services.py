"""Transactional transition boundary shared by future API and adapters."""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import CheckIn, Event


class Conflict(ValidationError):
    pass


RESPONSE_TRANSITIONS = {
    "pending": {"sent"},
    "sent": {"confirmed", "cancelled", "no_response"},
    "no_response": {"confirmed", "cancelled"},
    "confirmed": set(),
    "cancelled": set(),
}


@transaction.atomic
def transition(*, unit, checkin_id, version, idempotency_key, origin, response=None,
               attendance=None, actor=None, reason="", evidence=None, occurred_at=None):
    if unit.slug != "sansaude":
        raise ValidationError("Check-in disponível apenas para Sansaúde.")
    record = CheckIn.objects.select_for_update().get(pk=checkin_id, unit=unit)
    if not idempotency_key or len(idempotency_key) > 128:
        raise ValidationError("Chave de idempotência obrigatória.")
    old_event = Event.objects.filter(checkin=record, idempotency_key=idempotency_key).first()
    if old_event:
        if (old_event.origin != origin or old_event.actor_id != getattr(actor, "pk", None)
            or (response is not None and old_event.response != response)
            or (attendance is not None and old_event.attendance != attendance)
            or old_event.reason != reason or old_event.evidence != (evidence or {})):
            raise Conflict("Chave de idempotência reutilizada com outra operação.")
        return record, old_event
    if version != record.version:
        raise Conflict("Versão desatualizada.")
    if record.appointment_id and record.appointment.revision != record.source_revision:
        raise Conflict("Revisão do agendamento desatualizada.")
    if origin not in {"automatic", "operator", "oracle"}:
        raise ValidationError("Origem inválida.")
    if origin == "operator" and (not actor or not reason.strip()):
        raise ValidationError("Operador e motivo são obrigatórios.")
    response = response if response is not None else record.response
    attendance = attendance if attendance is not None else record.attendance
    if response not in CheckIn.Response.values or attendance not in CheckIn.Attendance.values:
        raise ValidationError("Estado inválido.")
    if response == record.response and attendance == record.attendance:
        raise ValidationError("Nenhuma mudança de estado.")
    if response != record.response:
        if origin == "oracle":
            raise ValidationError("Oracle não altera resposta.")
        if response not in RESPONSE_TRANSITIONS[record.response] and origin != "operator":
            raise ValidationError("Transição de resposta inválida.")
        if response == "no_response" and origin != "operator" and (not record.response_deadline or timezone.now() < record.response_deadline):
            raise ValidationError("Prazo de resposta ainda não expirou.")
    if attendance != record.attendance:
        if origin == "automatic":
            raise ValidationError("Comparecimento exige evidência ou operador.")
        if origin == "oracle" and (attendance != "attended" or not (evidence or {}).get("cd_atendimento_present")):
            raise ValidationError("Oracle exige CD_ATENDIMENTO preenchido; ausência não prova falta.")
    now = occurred_at or timezone.now()
    event = Event.objects.create(checkin=record, idempotency_key=idempotency_key, origin=origin, actor=actor,
        reason=reason, previous_response=record.response, response=response,
        previous_attendance=record.attendance, attendance=attendance, evidence=evidence or {}, occurred_at=now, version=record.version + 1)
    record.response, record.attendance = response, attendance
    record.version += 1
    if response == "sent" and event.previous_response != "sent":
        record.sent_at = now
    if response in {"confirmed", "cancelled"} and response != event.previous_response:
        record.responded_at = now
    if attendance != event.previous_attendance:
        record.attendance_checked_at = now
    record.save()
    return record, event
