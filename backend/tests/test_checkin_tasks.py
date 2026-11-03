from datetime import timedelta

import pytest
from django.test import override_settings
from django.utils import timezone

from checkin.models import CheckIn, Configuration
from checkin.tasks import tick
from core.models import Unit
from scheduling.models import Appointment


@pytest.mark.django_db
def test_tick_is_disabled_by_default_and_expires_only_enabled_sansaude():
    now = timezone.now()
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    config = Configuration.objects.create(unit=unit, enabled=True, appointment_enabled=True)
    appointment = Appointment.objects.create(unit=unit, external_id="1", kind="exam", patient="Teste", procedure="Teste", scheduled_at=now, arrival_time="")
    checkin = CheckIn.objects.create(unit=unit, appointment=appointment, scheduled_at=now, response="sent", response_deadline=now - timedelta(seconds=1))
    with override_settings(CHECKIN_SCHEDULER_ENABLED=False):
        tick()
    checkin.refresh_from_db()
    assert checkin.response == "sent"
    with override_settings(CHECKIN_SCHEDULER_ENABLED=True):
        config.enabled = False
        config.save()
        tick()
        checkin.refresh_from_db()
        assert checkin.response == "sent"
        config.enabled = True
        config.save()
        tick()
        tick()
    checkin.refresh_from_db()
    assert checkin.response == "no_response"
    assert checkin.attendance == "unknown"
    assert checkin.events.count() == 1


@pytest.mark.django_db
@override_settings(CHECKIN_SCHEDULER_ENABLED=True)
def test_tick_creates_review_for_stale_revision():
    from responses.models import Issue

    now = timezone.now()
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    Configuration.objects.create(unit=unit, enabled=True, appointment_enabled=True)
    appointment = Appointment.objects.create(unit=unit, external_id="1", kind="exam", patient="Teste", procedure="Teste", scheduled_at=now, arrival_time="", revision=2)
    checkin = CheckIn.objects.create(unit=unit, appointment=appointment, source_revision=1, scheduled_at=now, response="sent", response_deadline=now - timedelta(seconds=1))
    tick()
    tick()
    checkin.refresh_from_db()
    assert checkin.response == "sent"
    assert not checkin.events.exists()
    assert Issue.objects.filter(category="checkin_deadline_review").count() == 1


@pytest.mark.django_db
@override_settings(CHECKIN_SCHEDULER_ENABLED=True)
def test_tick_discovers_one_cycle_per_eligible_appointment():
    now = timezone.now()
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    Configuration.objects.create(unit=unit, enabled=True, appointment_enabled=True)
    appointment = Appointment.objects.create(unit=unit, external_id="new", kind="exam", patient="Teste", procedure="Teste", scheduled_at=now + timedelta(days=7), arrival_time="")
    tick()
    tick()
    assert CheckIn.objects.filter(appointment=appointment, cycle=1).count() == 1
