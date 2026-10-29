from datetime import datetime, timezone

import pytest
from django.core.exceptions import ValidationError
from autoagenda.models import Booking, Configuration as AutoConfiguration, Conversation
from checkin.intents import create_intent
from checkin.models import CheckIn, Configuration
from core.models import Unit
from responses.models import Issue
from scheduling.models import Appointment


@pytest.fixture
def data(db):
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde")
    config = Configuration.objects.create(unit=unit, enabled=True, appointment_enabled=True)
    appointment = Appointment.objects.create(unit=unit, external_id="1", kind="exam", patient="Teste", procedure="Teste", scheduled_at=datetime(2026, 11, 10, 15, tzinfo=timezone.utc), arrival_time="")
    return unit, config, appointment


def test_creation_is_idempotent_and_revision_and_cycle_are_explicit(data):
    unit, config, appointment = data
    now = datetime(2026, 11, 1, tzinfo=timezone.utc)
    first = create_intent(source=appointment, unit=unit, now=now)
    assert first.planned_send_at == datetime(2026, 11, 9, 15, tzinfo=timezone.utc)
    assert create_intent(source=appointment, unit=unit, now=now).pk == first.pk
    with pytest.raises(ValidationError): create_intent(source=appointment, unit=unit, cycle=2, now=now)
    CheckIn.objects.filter(pk=first.pk).update(response="confirmed")
    second = create_intent(source=appointment, unit=unit, cycle=2, now=now)
    CheckIn.objects.filter(pk=second.pk).update(response="confirmed")
    appointment.revision = 2
    appointment.save()
    assert create_intent(source=appointment, unit=unit, now=now).source_revision == 2
    assert CheckIn.objects.count() == 3


def test_late_creation_requires_one_review(data):
    unit, _, appointment = data
    now = datetime(2026, 11, 10, 14, tzinfo=timezone.utc)
    record = create_intent(source=appointment, unit=unit, now=now)
    assert record.planned_send_at is None
    create_intent(source=appointment, unit=unit, now=now)
    assert Issue.objects.filter(category="checkin_schedule_review").count() == 1


def test_disabled_cancelled_and_multiple_sources_rejected(data):
    unit, config, appointment = data
    config.booking_enabled = True
    config.save()
    with pytest.raises(ValidationError): create_intent(source=appointment, unit=unit)
    config.booking_enabled = False
    config.save()
    appointment.status = "cancelled"
    appointment.save()
    with pytest.raises(ValidationError): create_intent(source=appointment, unit=unit)
    assert not CheckIn.objects.exists()


def test_booking_missing_time_creates_review(data):
    unit, config, _ = data
    config.booking_enabled, config.appointment_enabled = True, False
    config.save()
    auto = AutoConfiguration.objects.create(unit=unit)
    conversation = Conversation.objects.create(unit=unit, configuration=auto, token_hash="unique", expires_at=datetime(2026, 12, 1, tzinfo=timezone.utc))
    booking = Booking.objects.create(unit=unit, conversation=conversation, state="confirmed", slot_id="1", specialty="", professional="", scheduled_for="inválido")
    record = create_intent(source=booking, unit=unit, now=datetime(2026, 11, 1, tzinfo=timezone.utc))
    assert record.scheduled_at is None and record.planned_send_at is None
    assert Issue.objects.filter(category="checkin_schedule_review").exists()


def test_message_uses_one_primary_recipient_and_is_idempotent(data):
    from checkin.deliveries import create_message
    from messaging.models import Template

    unit, _, appointment = data
    appointment.phone_numbers = ["11999990000", "11999990001"]
    appointment.save()
    record = create_intent(source=appointment, unit=unit, now=datetime(2026, 11, 1, tzinfo=timezone.utc))
    Template.objects.create(unit=unit, name="checkin_agendamento", language="pt_BR", purpose="checkin", body="Seu agendamento é em {{1}} às {{2}}. Responda: Confirmar ou Solicitar cancelamento.", fields=["date", "time"], approved_for_test=True)
    message = create_message(record.pk)
    assert message.recipient == "5511999990000"
    assert message.state == "preview"
    assert message.parameters == ["10/11/2026", "12:00"]
    assert create_message(record.pk).pk == message.pk
    assert "Teste" not in message.body
