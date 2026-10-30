"""Create a reviewable check-in cycle without sending any messages."""

from core.features import unit_feature_enabled
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from autoagenda.models import Booking
from scheduling.models import Appointment
from responses.models import Issue
from .models import CheckIn, Configuration
from .programming import ScheduleError, calculate_schedule
from .sources import source_snapshot


@transaction.atomic
def create_intent(*, source, unit, cycle=1, now=None):
    """Create one cycle per source revision; explicit new cycles only.

    This is deliberately not a sender: the queue adapter must still validate the
    current source, recipient, configuration and business window at dispatch.
    """
    if not unit_feature_enabled(unit, "checkin") or source.unit_id != unit.pk:
        raise ValidationError("Origem ou unidade não autorizada.")
    if type(cycle) is not int or cycle < 1:
        raise ValidationError("Ciclo inválido.")
    config = Configuration.objects.select_for_update().get(unit=unit)
    if not config.enabled:
        raise ValidationError("Check-in desativado.")
    # Until a cross-source identity is validated, enabling both risks duplicates.
    if config.booking_enabled == config.appointment_enabled:
        raise ValidationError("Habilite exatamente uma origem para evitar duplicidade.")
    if isinstance(source, Appointment):
        source = Appointment.objects.select_for_update().get(pk=source.pk, unit=unit)
        if not config.appointment_enabled or source.status != "scheduled":
            raise ValidationError("Agendamento não elegível.")
    elif isinstance(source, Booking):
        source = Booking.objects.select_for_update().get(pk=source.pk, unit=unit)
        if not config.booking_enabled or source.state != "confirmed":
            raise ValidationError("Reserva não elegível.")
    else:
        raise ValidationError("Origem não suportada.")
    snapshot = source_snapshot(source, unit, config.timezone)
    identity = {key: snapshot[key] for key in ("appointment", "booking") if key in snapshot}
    identity.update(source_revision=snapshot["source_revision"], cycle=cycle)
    existing = CheckIn.objects.filter(**identity).first()
    if existing:
        return existing
    if CheckIn.objects.filter(**{key: value for key, value in identity.items() if key not in ("cycle", "source_revision")}, response__in=["pending", "sent"]).exists():
        raise ValidationError("Existe ciclo anterior ainda ativo para esta origem.")
    try:
        schedule = calculate_schedule(snapshot["scheduled_at"], config, now or timezone.now())
        planned, deadline, reason = schedule.planned_send_at, schedule.response_deadline, None
    except ScheduleError as exc:
        planned, deadline, reason = None, snapshot["scheduled_at"], str(exc)
    record = CheckIn.objects.create(**snapshot, cycle=cycle, planned_send_at=planned,
                                    response_deadline=deadline)
    if reason:
        Issue.objects.create(unit=unit, category="checkin_schedule_review",
            description=f"Check-in {record.pk}: programação requer revisão ({reason}).")
    return record
