"""Pure scheduling calculations; no queue, database writes or transport access."""

from core.features import unit_feature_enabled
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


class ScheduleError(ValueError):
    """The schedule needs operator review or configuration correction."""


@dataclass(frozen=True)
class Schedule:
    planned_send_at: datetime
    response_deadline: datetime


def _boundary(day, clock, zone):
    local = datetime.combine(day, clock)
    first = local.replace(tzinfo=zone, fold=0)
    second = local.replace(tzinfo=zone, fold=1)
    if first.utcoffset() != second.utcoffset():
        raise ScheduleError("ambiguous_or_nonexistent_business_boundary")
    result = first.astimezone(timezone.utc)
    if result.astimezone(zone).replace(tzinfo=None) != local:
        raise ScheduleError("ambiguous_or_nonexistent_business_boundary")
    return result


def calculate_schedule(scheduled_at, config, now):
    """Return UTC instants. Business end is exclusive, at microsecond precision.

    The lead is elapsed time, including for days; an already elapsed window is
    deliberately returned as an exception for human review, never sent late.
    """
    if not unit_feature_enabled(config.unit, "checkin"):
        raise ScheduleError("unit_not_allowed")
    if not config.enabled:
        raise ScheduleError("disabled")
    if scheduled_at is None or scheduled_at.tzinfo is None or scheduled_at.utcoffset() is None:
        raise ScheduleError("invalid_appointment_time")
    if now.tzinfo is None or now.utcoffset() is None:
        raise ScheduleError("invalid_now")
    try:
        config.clean()
        if config.lead_unit not in {"hours", "days"}:
            raise ValueError("invalid lead unit")
        zone = ZoneInfo(config.timezone)
        delta = timedelta(**{config.lead_unit: config.lead_value})
    except (ValueError, TypeError, OverflowError) as exc:
        raise ScheduleError("invalid_configuration") from exc
    appointment = scheduled_at.astimezone(timezone.utc)
    target = appointment - delta
    local_day = target.astimezone(zone).date()
    holidays = set(config.holidays)
    for _ in range(3700):
        if local_day.weekday() in config.weekdays and local_day.isoformat() not in holidays:
            opening = _boundary(local_day, config.business_start, zone)
            closing = _boundary(local_day, config.business_end, zone)
            if closing <= opening:
                raise ScheduleError("invalid_business_window")
            candidate = min(target, closing - timedelta(microseconds=1))
            if candidate >= opening:
                if candidate < now.astimezone(timezone.utc) or candidate >= appointment:
                    raise ScheduleError("late_requires_review")
                return Schedule(candidate, appointment)
        local_day -= timedelta(days=1)
    raise ScheduleError("no_business_window")
