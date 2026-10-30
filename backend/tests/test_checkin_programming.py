from datetime import datetime, time, timezone

import pytest
from checkin.models import Configuration
from checkin.programming import ScheduleError, calculate_schedule
from core.models import Unit


def dt(day, hour, minute=0):
    return datetime(2026, 11, day, hour, minute, tzinfo=timezone.utc)


@pytest.fixture
def config(db):
    unit = Unit.objects.create(slug="sansaude", checkin_enabled=True, autoagenda_enabled=True, name="Sansaúde")
    return Configuration.objects.create(unit=unit, enabled=True)


def test_weekend_and_exclusive_closing(config):
    # Monday 12:00 local minus 24h is Sunday; Friday 18:00 is excluded.
    result = calculate_schedule(dt(9, 15), config, dt(1, 0))
    assert result.planned_send_at == datetime(2026, 11, 6, 20, 59, 59, 999999, tzinfo=timezone.utc)
    assert result.response_deadline == dt(9, 15)


def test_opening_closing_and_holiday(config):
    assert calculate_schedule(dt(10, 11), config, dt(1, 0)).planned_send_at == dt(9, 11)
    assert calculate_schedule(dt(10, 21), config, dt(1, 0)).planned_send_at.microsecond == 999999
    config.holidays = ["2026-11-09"]
    assert calculate_schedule(dt(10, 15), config, dt(1, 0)).planned_send_at.date().isoformat() == "2026-11-06"


def test_days_and_late_creation(config):
    config.lead_unit, config.lead_value = "days", 2
    assert calculate_schedule(dt(11, 15), config, dt(1, 0)).planned_send_at == dt(9, 15)
    with pytest.raises(ScheduleError, match="late_requires_review"):
        calculate_schedule(dt(11, 15), config, dt(10, 0))


def test_disabled_and_invalid_time(config):
    config.enabled = False
    with pytest.raises(ScheduleError, match="disabled"):
        calculate_schedule(dt(11, 15), config, dt(1, 0))
    config.enabled = True
    with pytest.raises(ScheduleError, match="invalid_appointment_time"):
        calculate_schedule(datetime(2026, 11, 11), config, dt(1, 0))


def test_timezone_and_ambiguous_boundary(config):
    config.timezone = "America/New_York"
    config.weekdays = list(range(7))
    config.business_start, config.business_end = time(1, 30), time(3)
    with pytest.raises(ScheduleError, match="ambiguous_or_nonexistent"):
        calculate_schedule(dt(2, 8), config, dt(1, 0))


def test_message_only_contains_time_and_options():
    from checkin.message import message_text

    assert message_text(dt(10, 15), "America/Sao_Paulo") == (
        "Seu agendamento é em 10/11/2026 às 12:00. "
        "Responda: Confirmar ou Solicitar cancelamento."
    )
    with pytest.raises(ValueError):
        message_text(None, "America/Sao_Paulo")
