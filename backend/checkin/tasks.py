"""Periodic maintenance of explicitly created check-in cycles."""
from celery import shared_task
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from .models import CheckIn
from .services import transition


@shared_task(name="checkin.tick")
def tick():
    # This additional switch keeps even maintenance inert until integration is ready.
    if not settings.CHECKIN_SCHEDULER_ENABLED:
        return
    now = timezone.now()
    create_cycles(now)
    queue_cycles(now)
    ids = list(CheckIn.objects.filter(
        unit__slug="sansaude", unit__checkin_configuration__enabled=True,
        response="sent", response_deadline__lte=now,
    ).order_by("response_deadline", "pk").values_list("pk", flat=True)[:100])
    for pk in ids:
        with transaction.atomic():
            record = CheckIn.objects.select_for_update().select_related("unit").get(pk=pk)
            if record.response != "sent" or not record.response_deadline or record.response_deadline > now:
                continue
            try:
                transition(unit=record.unit, checkin_id=pk, version=record.version,
                           idempotency_key="deadline", origin="automatic", response="no_response")
            except ValidationError:
                # Stale source revisions need human review, not an unaudited transition.
                from responses.models import Issue
                Issue.objects.get_or_create(unit=record.unit, category="checkin_deadline_review",
                    description=f"Check-in {record.pk}: prazo requer revisão da equipe.", resolved_at=None)


def create_cycles(now):
    """Discover eligible origins; identity and eligibility are rechecked under lock."""
    from autoagenda.models import Booking
    from scheduling.models import Appointment
    from .intents import create_intent
    from .sources import normalize_booking_time
    from .models import Configuration

    config = Configuration.objects.select_related("unit").filter(
        unit__slug="sansaude", enabled=True
    ).first()
    if not config or config.appointment_enabled == config.booking_enabled:
        return
    if config.appointment_enabled:
        existing = CheckIn.objects.filter(appointment_id=OuterRef("pk"), source_revision=OuterRef("revision"), cycle=1)
        active = CheckIn.objects.filter(appointment_id=OuterRef("pk"), response__in=["pending", "sent"])
        sources = Appointment.objects.filter(unit=config.unit, status="scheduled", scheduled_at__gt=now).annotate(
            already=Exists(existing), active=Exists(active)
        ).filter(already=False, active=False).order_by("scheduled_at", "pk")[:100]
    else:
        existing = CheckIn.objects.filter(booking_id=OuterRef("pk"), source_revision=1, cycle=1)
        active = CheckIn.objects.filter(booking_id=OuterRef("pk"), response__in=["pending", "sent"])
        sources = Booking.objects.filter(unit=config.unit, state="confirmed").annotate(
            already=Exists(existing), active=Exists(active)
        ).filter(already=False, active=False).order_by("pk").iterator()
    processed = 0
    for source in sources:
        if isinstance(source, Booking):
            scheduled = normalize_booking_time(source.scheduled_for, config.timezone)
            if scheduled is not None and scheduled <= now:
                continue
        if processed >= 100:
            break
        processed += 1
        try:
            create_intent(source=source, unit=config.unit, now=now)
        except ValidationError:
            # Configuration or eligibility may have changed since discovery.
            continue


def queue_cycles(now):
    from .deliveries import create_message
    from messaging.models import Message

    records = CheckIn.objects.filter(unit__slug="sansaude", unit__checkin_configuration__enabled=True,
        response="pending", planned_send_at__isnull=False, response_deadline__gt=now).order_by("planned_send_at", "pk")
    queued = 0
    for record in records.iterator():
        if queued >= 100:
            break
        message = create_message(record.pk)
        if message and message.state == Message.State.PREVIEW:
            queued += Message.objects.filter(pk=message.pk, state=Message.State.PREVIEW).update(state=Message.State.QUEUED)


@shared_task(name="checkin.reconcile_oracle")
def reconcile_oracle():
    """Revisit pages each run so late Oracle arrivals are picked up."""
    if not settings.CHECKIN_ORACLE_SCHEDULER_ENABLED:
        return
    from core.models import Unit
    from .models import Configuration
    from .oracle_reconciliation import OracleAttendanceSource, reconcile_batch

    unit = Unit.objects.filter(slug="sansaude").first()
    if not unit or not Configuration.objects.filter(unit=unit, enabled=True, oracle_enabled=True).exists():
        return
    try:
        source = OracleAttendanceSource(unit)
    except ValueError:
        return
    # Freeze the upper bound so new records cannot make this run unending.
    last = CheckIn.objects.filter(unit=unit).order_by("-pk").values_list("pk", flat=True).first()
    cursor = 0
    while last and cursor < last:
        result = reconcile_batch(unit=unit, source=source, cursor=cursor)
        if result.status != "ok" or result.next_cursor is None or result.next_cursor <= cursor:
            break
        cursor = result.next_cursor
