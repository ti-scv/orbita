from datetime import date, datetime
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from operations.models import Case, Purpose, SourceEvent
from operations.oracle_absences import confirmed_attendance_stats, mapped_row
from scheduling.models import Appointment

pytestmark = pytest.mark.django_db


def _raw(**overrides):
    row = {
        "CD_PACIENTE": 101,
        "CD_IT_AGENDA_CENTRAL": 777,
        "NM_PACIENTE": "PACIENTE FICTÍCIO",
        "TP_ITEM": "A",
        "CD_ATENDIMENTO": None,
        "DT_AGENDA": datetime(2026, 10, 20, 15),
        "HR_AGENDA": datetime(2026, 10, 20, 10, 30),
        "DS_ITEM_AGENDAMENTO": "PROCEDIMENTO TESTE",
        "DS_CONSULTORIO": "SALA TESTE",
        "DT_NASCIMENTO": datetime(2000, 1, 2),
        "A_CELULAR": "999990001",
        "A_DDD_CELULAR": "17",
        "P_CELULAR": "17999990002",
        "A_FONE": "17999990001",
    }
    row.update(overrides)
    return row


def _confirmed_appointment(unit, **overrides):
    zone = ZoneInfo(unit.timezone)
    values = {
        "unit": unit,
        "source": "oracle",
        "external_id": "9001",
        "kind": "consultation",
        "patient": "PACIENTE FICTÍCIO",
        "patient_external_id": "101",
        "procedure": "Consulta",
        "arrival_time": "",
        "scheduled_at": timezone.make_aware(datetime(2026, 10, 20, 10, 30), zone),
    }
    values.update(overrides)
    appointment = Appointment.objects.create(**values)
    event = SourceEvent.objects.create(
        unit=unit,
        source="oracle",
        external_id=appointment.external_id,
        kind=appointment.kind,
        patient=appointment.patient,
        occurred_at=appointment.scheduled_at,
        appointment=appointment,
    )
    Case.objects.create(
        unit=unit, event=event, purpose=Purpose.APPOINTMENT, outcome="confirmed"
    )
    return appointment


def test_confirmed_no_show_uses_absence_logic(setup, monkeypatch):
    unit = setup["unit"]
    _confirmed_appointment(unit)
    monkeypatch.setattr(
        "operations.oracle_absences.fetch_absences_range",
        lambda *args, **kwargs: [mapped_row(_raw())],
    )
    stats = confirmed_attendance_stats(
        unit,
        Appointment.objects.filter(unit=unit),
        date(2026, 10, 20),
        date(2026, 10, 20),
    )
    assert stats == {
        "appointments_confirmed": 1,
        "appointments_no_show": 1,
        "attendance_available": True,
    }


def test_confirmed_who_attended_is_not_no_show(setup, monkeypatch):
    unit = setup["unit"]
    _confirmed_appointment(unit)
    monkeypatch.setattr(
        "operations.oracle_absences.fetch_absences_range",
        lambda *args, **kwargs: [],
    )
    stats = confirmed_attendance_stats(
        unit,
        Appointment.objects.filter(unit=unit),
        date(2026, 10, 20),
        date(2026, 10, 20),
    )
    assert stats["appointments_confirmed"] == 1
    assert stats["appointments_no_show"] == 0
    assert stats["attendance_available"] is True


def test_oracle_failure_keeps_confirmed_count(setup, monkeypatch):
    unit = setup["unit"]
    _confirmed_appointment(unit)
    monkeypatch.setattr(
        "operations.oracle_absences.fetch_absences_range",
        lambda *args, **kwargs: (_ for _ in ()).throw(ValidationError("oracle offline")),
    )
    stats = confirmed_attendance_stats(
        unit,
        Appointment.objects.filter(unit=unit),
        date(2026, 10, 20),
        date(2026, 10, 20),
    )
    assert stats["appointments_confirmed"] == 1
    assert stats["appointments_no_show"] == 0
    assert stats["attendance_available"] is False


def test_fetch_absences_range_reuses_same_sql(setup, monkeypatch):
    from operations.oracle_absences import fetch_absences_range

    row = _raw()
    cursor = MagicMock()
    cursor.__enter__.return_value = cursor
    cursor.description = [(key,) for key in row]
    cursor.fetchmany.return_value = [tuple(row.values())]
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.cursor.return_value = cursor
    monkeypatch.setattr(
        "operations.oracle_absences.connection_payload",
        lambda unit: {"timeout_ms": 10000},
    )
    monkeypatch.setattr(
        "operations.oracle_absences.connect", lambda payload: connection
    )
    rows = fetch_absences_range(
        setup["unit"], date(2026, 10, 20), date(2026, 10, 21), "A"
    )
    sql = cursor.execute.call_args_list[1].args[0]
    assert "a.CD_ATENDIMENTO IS NULL" in sql
    assert cursor.execute.call_args_list[1].kwargs == {
        "start_day": datetime(2026, 10, 20),
        "end_day": datetime(2026, 10, 22),
        "item_type": "A",
    }
    assert rows[0]["patient_external_id"] == "101"
