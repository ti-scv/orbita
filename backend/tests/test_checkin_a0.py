from datetime import timedelta
import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from checkin.models import CheckIn, Configuration, Event
from checkin.services import Conflict, transition
from core.access import check_resource, role_permissions
from core.models import Unit
from scheduling.models import Appointment


@pytest.fixture
def data(db):
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    other = Unit.objects.create(slug="other", name="Outra")
    appointment = Appointment.objects.create(unit=unit, external_id="1", kind="exam", patient="Teste", procedure="Teste", scheduled_at=timezone.now(), arrival_time="")
    record = CheckIn.objects.create(unit=unit, appointment=appointment, source_revision=1)
    return unit, other, appointment, record


def test_defaults_and_isolation(data):
    unit, other, appointment, record = data
    config = Configuration.objects.create(unit=unit)
    assert not any([config.enabled, config.booking_enabled, config.appointment_enabled, config.oracle_enabled])
    assert (config.channel, config.lead_value, config.lead_unit, config.weekdays) == ("meta", 24, "hours", [0, 1, 2, 3, 4])
    config.holidays = ["2026-02-30"]
    with pytest.raises(ValidationError): config.save()
    config.holidays = []
    config.lead_value = 0
    with pytest.raises(ValidationError): config.save()
    with pytest.raises(ValidationError): Configuration.objects.create(unit=other)
    with pytest.raises(ValidationError): CheckIn.objects.create(unit=other, appointment=appointment)
    with pytest.raises(ValidationError): CheckIn.objects.create(unit=unit)
    with pytest.raises(ValidationError): CheckIn.objects.create(unit=unit, appointment=appointment)
    with pytest.raises(ValidationError): transition(unit=other, checkin_id=record.pk, version=1, idempotency_key="x", origin="automatic", response="sent")


def test_transitions_idempotency_and_revision(data):
    unit, _, appointment, record = data
    args = dict(unit=unit, checkin_id=record.pk, version=1, idempotency_key="send", origin="automatic", response="sent")
    record, event = transition(**args)
    assert record.version == 2 and record.sent_at and event.previous_response == "pending"
    assert transition(**args)[1].pk == event.pk
    with pytest.raises(Conflict): transition(**{**args, "response": "confirmed"})
    with pytest.raises(Conflict): transition(**{**args, "idempotency_key": "other"})
    with pytest.raises(ValidationError): transition(unit=unit, checkin_id=record.pk, version=2, idempotency_key="early", origin="automatic", response="no_response")
    actor = get_user_model().objects.create_user(username="operator")
    with pytest.raises(ValidationError): transition(unit=unit, checkin_id=record.pk, version=2, idempotency_key="early-manual", origin="operator", actor=actor, reason="teste", response="no_response")
    record, _ = transition(unit=unit, checkin_id=record.pk, version=2, idempotency_key="yes", origin="automatic", response="confirmed")
    with pytest.raises(ValidationError): transition(unit=unit, checkin_id=record.pk, version=3, idempotency_key="absent", origin="oracle", attendance="absent")
    record, _ = transition(unit=unit, checkin_id=record.pk, version=3, idempotency_key="attended", origin="oracle", attendance="attended", evidence={"cd_atendimento_present": True})
    assert record.response == "confirmed" and record.attendance == "attended"
    with pytest.raises(ValidationError): event.delete()
    with pytest.raises(ValidationError): Event.objects.filter(pk=event.pk).update(reason="changed")
    appointment.revision = 2; appointment.save()
    with pytest.raises(Conflict): transition(unit=unit, checkin_id=record.pk, version=4, idempotency_key="stale", origin="automatic", response="cancelled")


def test_permissions():
    assert role_permissions("operator")["checkin"] == "none"
    read = role_permissions("operator", {"checkin": "read"})
    check_resource(read, "checkins/", "GET", {})
    with pytest.raises(PermissionDenied): check_resource(read, "checkins/", "POST", {})
    check_resource(role_permissions("operator", {"checkin": "write"}), "checkins/", "POST", {})

@pytest.mark.django_db(transaction=True)
def test_concurrent_idempotent_transition():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import close_old_connections, connection, connections
    if connection.vendor != "postgresql":
        pytest.skip("Bloqueio de linha exige PostgreSQL")
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    appointment = Appointment.objects.create(unit=unit, external_id="1", kind="exam", patient="Teste", procedure="Teste", scheduled_at=timezone.now(), arrival_time="")
    record = CheckIn.objects.create(unit=unit, appointment=appointment)
    gate = Barrier(2)
    def call():
        close_old_connections()
        gate.wait(timeout=10)
        try:
            return transition(unit=unit, checkin_id=record.pk, version=1, idempotency_key="same", origin="automatic", response="sent")[1].pk
        finally:
            connections.close_all()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: call(), range(2)))
    assert results[0] == results[1]
    assert Event.objects.filter(checkin=record).count() == 1
    record.refresh_from_db()
    assert record.version == 2


def test_source_snapshots(data):
    from autoagenda.models import Booking
    from checkin.sources import normalize_booking_time, source_snapshot
    unit, other, appointment, _ = data
    assert source_snapshot(appointment, unit)["source_revision"] == 1
    booking = Booking(unit=unit, scheduled_for="30/10/2026 09:00:00")
    snapshot = source_snapshot(booking, unit)
    assert snapshot["scheduled_at"].isoformat() == "2026-10-30T12:00:00+00:00"
    assert normalize_booking_time("inválido", "America/Sao_Paulo") is None
    assert normalize_booking_time("2018-11-04T00:30:00", "America/Sao_Paulo") is None
    with pytest.raises(ValidationError): source_snapshot(appointment, other)
