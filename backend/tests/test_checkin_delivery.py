from datetime import timedelta

import pytest
from django.test import override_settings
from django.utils import timezone

from checkin.deliveries import create_message, dispatch_error
from checkin.models import CheckIn, Configuration
from core.models import Unit
from messaging.models import Template
from responses.models import Issue
from responses.services import apply_reply, store_event
from scheduling.models import Appointment


@pytest.fixture
def delivery(db):
    now = timezone.now()
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde")
    Configuration.objects.create(unit=unit, enabled=True, appointment_enabled=True)
    appointment = Appointment.objects.create(unit=unit, external_id="c1", kind="exam", patient="Pessoa", procedure="Exame", phone="11999990000", scheduled_at=now + timedelta(days=1), arrival_time="")
    record = CheckIn.objects.create(unit=unit, appointment=appointment, scheduled_at=appointment.scheduled_at, planned_send_at=now - timedelta(minutes=1), response_deadline=appointment.scheduled_at)
    Template.objects.create(unit=unit, name="checkin_agendamento", language="pt_BR", purpose="checkin", body="Seu agendamento é em {{1}} às {{2}}. Responda: Confirmar ou Solicitar cancelamento.", fields=["date", "time"], approved_for_test=True)
    message = create_message(record.pk)
    return record, message, now


@pytest.mark.django_db
@override_settings(CHECKIN_SCHEDULER_ENABLED=True)
def test_guard_blocks_changed_source_and_recipient(delivery):
    record, message, now = delivery
    record.appointment.revision += 1
    record.appointment.save()
    assert dispatch_error(message, now) == "checkin_source_changed"
    record.appointment.revision -= 1
    record.appointment.phone = "11999990001"
    record.appointment.save()
    assert dispatch_error(message, now) == "checkin_recipient_changed"


@pytest.mark.django_db
@pytest.mark.parametrize("text,response,issue", [("Confirmar", "confirmed", False), ("Solicitar cancelamento", "cancelled", True)])
def test_reply_correlates_and_cancellation_only_creates_issue(delivery, text, response, issue):
    record, message, now = delivery
    message.provider_id = "wamid.test"
    message.channel_id = "meta-test"
    message.state = "accepted"
    message.save()
    record.message_id = str(message.pk)
    record.provider_message_id = message.provider_id
    record.response = "sent"
    record.sent_at = now - timedelta(seconds=2)
    record.save()
    event = store_event("meta-test", "reply-id", "reply", int(now.timestamp()), {"sender": message.recipient, "text": text, "context_id": message.provider_id})
    apply_reply(event, record.unit)
    apply_reply(event, record.unit)
    record.refresh_from_db()
    record.appointment.refresh_from_db()
    assert record.response == response
    assert record.appointment.status == "scheduled"
    assert record.events.count() == 1
    assert Issue.objects.filter(category="checkin_cancel_request").exists() is issue


@pytest.mark.django_db
def test_reply_without_context_never_guesses_checkin(delivery):
    record, message, now = delivery
    message.provider_id = "wamid.test"
    message.channel_id = "meta-test"
    message.state = "accepted"
    message.response_state = "pending"
    message.save()
    record.response = "sent"
    record.sent_at = now - timedelta(seconds=2)
    record.save()
    event = store_event("meta-test", "no-context", "reply", int(now.timestamp()), {"sender": message.recipient, "text": "Confirmar"})
    apply_reply(event, record.unit)
    record.refresh_from_db()
    assert record.response == "sent"
    assert Issue.objects.filter(category="unlinked_reply").exists()
