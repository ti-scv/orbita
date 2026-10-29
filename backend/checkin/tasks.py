"""Periodic maintenance of explicitly created check-in cycles."""
from celery import shared_task
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import CheckIn
from .services import transition


@shared_task(name="checkin.tick")
def tick():
    # This additional switch keeps even maintenance inert until integration is ready.
    if not settings.CHECKIN_SCHEDULER_ENABLED:
        return
    now = timezone.now()
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
