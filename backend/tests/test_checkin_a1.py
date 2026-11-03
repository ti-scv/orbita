import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from checkin.models import CheckIn, Event
from core.models import Membership, Unit
from scheduling.models import Appointment


@pytest.fixture
def setup(db):
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    other = Unit.objects.create(slug="other", name="Outra")
    user = get_user_model().objects.create_user(username="operator")
    member = Membership.objects.create(user=user, unit=unit, role="operator", permissions={"checkin": "write", "appointments": "read"})
    Membership.objects.create(user=user, unit=other, role="admin")
    appointment = Appointment.objects.create(unit=unit, external_id="1", kind="exam", patient="Teste", procedure="Teste", scheduled_at=timezone.now(), arrival_time="")
    record = CheckIn.objects.create(unit=unit, appointment=appointment, source_revision=appointment.revision, scheduled_at=appointment.scheduled_at)
    client = APIClient()
    client.force_authenticate(user)
    return client, member, appointment, record


def test_access_transition_audit_and_revision(setup):
    client, member, appointment, record = setup
    url = f"/api/v1/checkins/{record.pk}/transition/?unit=sansaude"
    body = {"version": 1, "idempotency_key": "one", "reason": "Paciente informou", "response": "cancelled"}
    assert client.get("/api/v1/checkins/?unit=other").status_code == 403
    member.permissions["checkin"] = "read"
    member.save()
    assert client.post(url, body, format="json").status_code == 403
    assert client.get("/api/v1/checkins/?unit=sansaude").status_code == 200
    member.permissions["checkin"] = "write"
    member.save()
    response = client.post(url, body, format="json")
    assert response.status_code == 200, response.data
    assert response.data["checkin"]["response"] == "cancelled"
    assert client.post(url, body, format="json").data["event_id"] == response.data["event_id"]
    assert Event.objects.filter(checkin=record).count() == 1
    assert client.post(url, {**body, "response": "confirmed"}, format="json").status_code == 409
    assert client.post(url, {**body, "idempotency_key": "two"}, format="json").status_code == 409
    appointment.revision += 1
    appointment.save()
    assert client.post(url, {**body, "version": 2, "idempotency_key": "three", "response": "confirmed"}, format="json").status_code == 409
    event = Event.objects.get(checkin=record)
    assert event.actor == member.user and event.reason == body["reason"] and event.origin == "operator"


def test_configuration_and_detail(setup):
    client, member, appointment, record = setup
    url = "/api/v1/checkin-configuration/?unit=sansaude"
    config = client.get(url)
    assert config.status_code == 200 and not config.data["enabled"]
    assert client.patch(url, {"lead_value": 0}, format="json").status_code == 400
    assert client.patch(url, {"lead_value": 48}, format="json").data["lead_value"] == 48
    detail = client.get(f"/api/v1/appointments/{appointment.pk}/?unit=sansaude")
    assert detail.status_code == 200 and detail.data["checkin"]["label"] == "pending"
    member.permissions["checkin"] = "none"
    member.save()
    assert client.get(f"/api/v1/appointments/{appointment.pk}/?unit=sansaude").data["checkin"] is None


def test_filters(setup):
    client, _, appointment, record = setup
    local_date = timezone.localtime(appointment.scheduled_at).date().isoformat()
    url = "/api/v1/checkins/?unit=sansaude"
    assert client.get(url, {"unit": "sansaude", "source": "appointment", "start": local_date, "end": local_date}).data["count"] == 1
    assert client.get(url, {"unit": "sansaude", "source": "booking"}).data["count"] == 0
    assert client.get(url, {"unit": "sansaude", "response": "wrong"}).status_code == 400


def test_booking_detail_and_cancellation_does_not_change_booking(setup):
    from autoagenda.models import Booking, Configuration as AutoConfiguration, Conversation
    client, member, _, _ = setup
    member.permissions["autoagenda"] = "read"
    member.save()
    unit = member.unit
    config = AutoConfiguration.objects.create(unit=unit)
    conversation = Conversation.objects.create(unit=unit, configuration=config, token_hash="hash", expires_at=timezone.now())
    booking = Booking.objects.create(unit=unit, conversation=conversation, state="confirmed", slot_id="slot", specialty="Teste", professional="Teste", scheduled_for="30/10/2026 09:00:00")
    record = CheckIn.objects.create(unit=unit, booking=booking)
    url = f"/api/v1/autoagenda/conversations/{conversation.pk}/?unit=sansaude"
    assert client.get(url).data["booking"]["checkin"]["label"] == "pending"
    result = client.post(f"/api/v1/checkins/{record.pk}/transition/?unit=sansaude", {"version": 1, "idempotency_key": "cancel", "reason": "Pedido", "response": "cancelled"}, format="json")
    assert result.status_code == 200
    booking.refresh_from_db()
    assert booking.state == "confirmed"
    assert client.get(url).data["booking"]["checkin"]["label"] == "cancelled"


@pytest.mark.django_db(transaction=True)
def test_concurrent_operator_retries():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import close_old_connections, connection, connections
    if connection.vendor != "postgresql":
        pytest.skip("Bloqueio de linha exige PostgreSQL")
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    user = get_user_model().objects.create_user(username="concurrent")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions={"checkin": "write"})
    appointment = Appointment.objects.create(unit=unit, external_id="1", kind="exam", patient="Teste", procedure="Teste", scheduled_at=timezone.now(), arrival_time="")
    record = CheckIn.objects.create(unit=unit, appointment=appointment)
    gate = Barrier(2)
    def call():
        close_old_connections()
        client = APIClient()
        client.force_authenticate(user)
        gate.wait(timeout=30)
        try:
            result = client.post(f"/api/v1/checkins/{record.pk}/transition/?unit=sansaude", {"version": 1, "idempotency_key": "same", "reason": "Pedido", "response": "cancelled"}, format="json")
            return result.status_code, result.data["event_id"]
        finally:
            connections.close_all()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: call(), range(2)))
    assert results[0] == results[1] and results[0][0] == 200
    assert Event.objects.filter(checkin=record).count() == 1
